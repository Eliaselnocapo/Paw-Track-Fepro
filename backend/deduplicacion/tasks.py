import logging

from celery import shared_task

from bd.models import Incidencia
from deduplicacion.filtros import candidatos_por_metadatos
from deduplicacion.ranking import RankingService
from deduplicacion.services import VisionService, fusionar
from notificaciones.services import (
    broadcast_duplicate_detected,
    broadcast_new_report,
    broadcast_revision_requerida,
)

logger = logging.getLogger(__name__)


# Fix P0-4: Forzamos la tarea a una cola dedicada ('dedup') para evitar colisiones 
# al escribir en el índice HNSW.
@shared_task(queue='dedup')
def check_duplicados(incidencia_id):
    logger.info("check_duplicados iniciado para incidencia %s", incidencia_id)

    try:
        nueva_incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        logger.warning("check_duplicados: incidencia %s no encontrada", incidencia_id)
        return "Incidencia no encontrada"

    if not nueva_incidencia.imagen:
        broadcast_new_report(nueva_incidencia)
        return "Sin imagen, omitiendo deduplicación"

    especie = nueva_incidencia.animal.tipo
    vision_ai = VisionService()

    # Usamos _get_embedding directo del servicio.
    try:
        emb = vision_ai._get_embedding(nueva_incidencia.imagen.path, especie)
    except ValueError as e:
        logger.error("Deduplicación abortada: %s", e)
        return "Especie no soportada para IA"

    # Filtros baratos (geo + estructura)
    candidatos = [c for c in candidatos_por_metadatos(nueva_incidencia) if c.imagen]

    if not candidatos:
        # Pasamos el embedding ya calculado
        vision_ai.aprender_embedding(emb, especie, nueva_incidencia.id)
        broadcast_new_report(nueva_incidencia)
        return "No se encontraron candidatos tras el filtro geográfico y de especie."

    # Inferencia IA (Solo lectura)
    candidatos_ids = [c.id for c in candidatos]
    # Pasamos el embedding ya calculado
    similitud_visual = vision_ai.buscar_similares(emb, especie, candidatos_ids)

    # Pasamos el embedding ya calculado
    vision_ai.aprender_embedding(emb, especie, nueva_incidencia.id)

    #  Ranking final
    resultados = RankingService.calcular_score_final(candidatos, similitud_visual, nueva_incidencia)

    if not resultados:
        broadcast_new_report(nueva_incidencia)
        return "Sin resultados de ranking."

    # Fix P0-5: Guardamos los resultados ordenados en la BD para que el 
    # serializer los lea de aquí y no bloquee las peticiones GET.
    nueva_incidencia.coincidencias_visuales_ids = [r["incidencia"].id for r in resultados]
    nueva_incidencia.save(update_fields=['coincidencias_visuales_ids'])

    mejor = resultados[0]
    mejor_candidato, score_final = mejor["incidencia"], mejor["score"]
    logger.info(
        "check_duplicados: mejor candidato para %s es %s (score_final=%.3f)",
        incidencia_id, mejor_candidato.id, score_final,
    )

    if score_final >= RankingService.UMBRAL_FUSION:
        fusionar(original=mejor_candidato, duplicado=nueva_incidencia)
        broadcast_duplicate_detected(nueva_incidencia, mejor_candidato)
        return f"Fusionado con incidencia {mejor_candidato.id} (score_final={score_final:.2f})"

    if score_final >= RankingService.UMBRAL_REVISION:
        nueva_incidencia.estado = 'EN_REVISION'
        nueva_incidencia.save(update_fields=['estado'])
        broadcast_revision_requerida(nueva_incidencia, mejor_candidato)
        return f"En revisión, posible duplicado de {mejor_candidato.id} (score_final={score_final:.2f})"

    broadcast_new_report(nueva_incidencia)
    return f"Caso nuevo independiente (mejor score_final={score_final:.2f})"