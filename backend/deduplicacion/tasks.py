import logging

from celery import shared_task

from bd.models import Incidencia
from deduplicacion.services import VisionService

logger = logging.getLogger(__name__)


@shared_task
def aprender_incidencia(incidencia_id):
    """
    Aprende el embedding de una incidencia nueva en el índice HNSW, para que
    futuros reportes puedan encontrarla como candidato a duplicado.

    La detección de duplicados ya NO corre aquí de forma async después de
    crear el reporte: se movió a bd.views.IncidenciaViewSet.verificar_duplicado,
    que corre de forma síncrona en el paso 4 del wizard de reporte (ANTES de
    guardar nada), para que el reportante pueda confirmar o descartar el
    candidato en el momento. Esta task solo hace la mitad "aprendizaje" del
    pipeline viejo — sigue siendo async porque no bloquea nada que el
    reportante esté esperando.
    """
    try:
        incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        logger.warning("aprender_incidencia: incidencia %s no encontrada", incidencia_id)
        return "Incidencia no encontrada"

    if not incidencia.imagen or not incidencia.animal:
        return "Sin imagen o sin animal, nada que aprender."

    VisionService().aprender(incidencia.imagen.path, incidencia.animal.tipo, incidencia.id)
    return f"Incidencia {incidencia_id} aprendida en el índice."
