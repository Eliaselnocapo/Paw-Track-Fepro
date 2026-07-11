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


@shared_task
def check_duplicados(incidencia_id):
    logger.info("check_duplicados iniciado para incidencia %s", incidencia_id)

    try:
        nueva_incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        logger.warning("check_duplicados: incidencia %s no encontrada", incidencia_id)
        return "Incidencia no encontrada"

    # La imagen vive en el modelo Incidencia, no en Animal.
    if not nueva_incidencia.imagen:
        broadcast_new_report(nueva_incidencia)
        return "Sin imagen, omitiendo deduplicación"

    especie = nueva_incidencia.animal.tipo
    vision_ai = VisionService()

    # 1. Filtros baratos (geo + estructura) — deduplicacion/filtros.py
    candidatos = [c for c in candidatos_por_metadatos(nueva_incidencia) if c.imagen]

    if not candidatos:
        # Nada con qué comparar: igual aprendemos esta imagen para futuras comparaciones.
        vision_ai.aprender(nueva_incidencia.imagen.path, especie, nueva_incidencia.id)
        broadcast_new_report(nueva_incidencia)
        return "No se encontraron candidatos tras el filtro geográfico y de especie."

    # 2. Inferencia IA — similitud visual de solo lectura contra el índice existente
    candidatos_ids = [c.id for c in candidatos]
    similitud_visual = vision_ai.get_similarity_scores(
        nueva_incidencia.imagen.path, especie, candidatos_ids
    )

    # Aprender este reporte nuevo (mutar el índice) DESPUÉS de buscar, una sola vez.
    vision_ai.aprender(nueva_incidencia.imagen.path, especie, nueva_incidencia.id)

    # 3. Ranking final — pesos ponderados sobre geo + estructura + foto + texto
    resultados = RankingService.calcular_score_final(candidatos, similitud_visual, nueva_incidencia)

    if not resultados:
        broadcast_new_report(nueva_incidencia)
        return "Sin resultados de ranking."

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
