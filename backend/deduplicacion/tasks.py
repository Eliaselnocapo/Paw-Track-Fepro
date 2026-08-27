import logging
import os
from celery import shared_task

from bd.models import Incidencia
from deduplicacion.filtros import candidatos_por_metadatos
from deduplicacion.ranking import RankingService
from deduplicacion.services import VisionService

logger = logging.getLogger(__name__)


# Fix P0-4/P0-2 (Manuel, S4/S5): cola dedicada 'dedup' + lock real en
# VisionService.aprender_embedding() protegen la escritura del índice HNSW
# compartido — esta es ahora la ÚNICA task que lo muta.
@shared_task(queue='dedup')
def aprender_incidencia(incidencia_id):
    """
    Aprende el embedding de una incidencia nueva en el índice HNSW, para que
    futuros chequeos de verificar_duplicado() la encuentren como candidato.
    De paso, calcula y guarda coincidencias_visuales_ids — la lista de
    incidencias visualmente parecidas ya rankeadas — para que
    IncidenciaSerializer.get_coincidencias_visuales() la lea directo sin
    volver a invocar la IA en cada GET (Fix P0-5, Manuel).

    La detección/confirmación de duplicados en sí ya NO corre aquí de forma
    async: se movió a bd.views.IncidenciaViewSet.verificar_duplicado, que
    corre de forma síncrona en el paso 4 del wizard de reporte (ANTES de
    guardar nada), para que el reportante pueda confirmar o descartar el
    candidato en el momento — ver decision-tecnica-filtro-raza.md. Esta task
    solo hace la mitad "aprendizaje + índice de similares" del pipeline
    viejo (check_duplicados, eliminado).
    """
    try:
        incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        logger.warning("aprender_incidencia: incidencia %s no encontrada", incidencia_id)
        return "Incidencia no encontrada"

    if not incidencia.imagen or not incidencia.animal:
        return "Sin imagen o sin animal, nada que aprender."

    especie = incidencia.animal.tipo
    vision_ai = VisionService()

    try:
        emb = vision_ai._get_embedding(incidencia.imagen.path, especie)
    except ValueError as e:
        logger.error("aprender_incidencia: %s", e)
        return "Especie no soportada para IA"

    # Candidatos existentes (solo lectura) — antes de aprender, para no
    # compararnos contra nuestro propio embedding recién insertado.
    candidatos = [c for c in candidatos_por_metadatos(incidencia) if c.imagen]
    if candidatos:
        candidatos_ids = [c.id for c in candidatos]
        similitud_visual = vision_ai.buscar_similares(emb, especie, candidatos_ids)
        resultados = RankingService.calcular_score_final(candidatos, similitud_visual, incidencia)
        incidencia.coincidencias_visuales_ids = [r["incidencia"].id for r in resultados]
        incidencia.save(update_fields=['coincidencias_visuales_ids'])

    vision_ai.aprender_embedding(emb, especie, incidencia.id)
    return f"Incidencia {incidencia_id} aprendida en el índice."

@shared_task(queue='dedup')
def calcular_embedding_borrador(borrador_id, ruta_temporal, especie):
    """
    Precarga del wizard (paso 2→3): calcula el embedding de la foto ANTES
    de que el usuario llegue al paso 4, mientras llena mapa/revisión. El
    resultado se cachea en Redis con TTL de 30 min; verificar_duplicado()
    lo busca ahí primero y solo recalcula si no lo encuentra (usuario muy
    rápido, o esta tarea aún no terminó) -- nunca bloquea, solo acelera.

    La llave del cache incluye la especie (no solo el borrador_id): si el
    usuario cambia de especie en el wizard y el frontend llega a mandar un
    borrador_id desfasado junto con el tipo_animal nuevo,
    verificar_duplicado() debe fallar el cache-hit y recalcular con el
    modelo correcto, en vez de comparar en silencio contra el índice
    equivocado (bug real: los embeddings de perro y gato tienen la misma
    dimensión, así que un cruce de especie no truena, solo ensucia el
    resultado sin ningún error visible).
    """
    from django.core.cache import cache

    vision_ai = VisionService()
    try:
        emb = vision_ai._get_embedding(ruta_temporal, especie)
        cache.set(f'embedding_borrador:{borrador_id}:{especie.lower()}',
                   emb.astype('float32').tobytes(), timeout=1800)
        logger.info("Embedding de borrador %s (%s) precalculado y cacheado.", borrador_id, especie)
    except ValueError as e:
        logger.warning("calcular_embedding_borrador: %s", e)
    finally:
        try:
            os.remove(ruta_temporal)
        except OSError:
            pass


@shared_task(queue='dedup')
def detectar_especie_borrador(imagen_borrador_id, ruta_temporal):
    """
    Corre YOLO (clases COCO) sobre la foto apenas se sube en Modo 1 de
    precargar_imagen, en paralelo a que el usuario llena el resto del
    wizard -- NO decide la especie del reporte (eso lo sigue eligiendo el
    reportante en el paso 2), solo deja cacheado un veredicto barato de
    "¿esto parece perro o gato?" para que el frontend consulte
    (IncidenciaViewSet.deteccion_especie) y decida si mostrar un aviso
    antes de enviar.

    A diferencia de calcular_embedding_borrador, esta task NO borra
    ruta_temporal al terminar: es el mismo archivo que después necesita
    calcular_embedding_borrador (Modo 2) para el embedding real -- borrarlo
    aquí rompería ese flujo. El borrado del temporal sigue siendo
    responsabilidad exclusiva de calcular_embedding_borrador.

    Nunca bloquea ni hace fallar nada: si la detección falla o no ha
    terminado cuando el usuario llega a revisión, el endpoint de consulta
    regresa "sin información" y el reporte sigue su curso normal.
    """
    from django.core.cache import cache
    from deduplicacion.services import DeteccionEspecieService

    try:
        servicio = DeteccionEspecieService()
        resultado = servicio.detectar(ruta_temporal)
    except Exception:
        logger.exception("detectar_especie_borrador: fallo inesperado para borrador %s", imagen_borrador_id)
        return "Error al detectar especie"

    if resultado is None:
        return "Sin resultado (ver logs)"

    cache.set(f'deteccion_especie:{imagen_borrador_id}', resultado, timeout=1800)
    logger.info("Detección de especie para borrador %s: %s", imagen_borrador_id, resultado)
    return f"Detección cacheada para {imagen_borrador_id}: {resultado}"
