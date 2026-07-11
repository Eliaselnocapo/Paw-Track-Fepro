import logging

from django.db.models.signals import post_save
from django.dispatch import receiver
from bd.models import Incidencia
from deduplicacion.tasks import check_duplicados

logger = logging.getLogger(__name__)


# Esta señal "escucha" cada vez que se guarda una Incidencia
@receiver(post_save, sender=Incidencia)
def disparar_motor_vision(sender, instance, created, **kwargs):
    # 'created' es True solo cuando es un reporte NUEVO (el INSERT), no un UPDATE
    if created:
        logger.info("Nueva incidencia %s creada, lanzando check_duplicados.", instance.id)
        check_duplicados.delay(instance.id)