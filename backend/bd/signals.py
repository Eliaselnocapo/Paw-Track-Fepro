import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from bd.models import Incidencia
from deduplicacion.tasks import aprender_incidencia

logger = logging.getLogger(__name__)


# Esta señal "escucha" cada vez que se guarda una Incidencia
@receiver(post_save, sender=Incidencia)
def disparar_motor_vision(sender, instance, created, **kwargs):
    # 'created' es True solo cuando es un reporte NUEVO (el INSERT), no un UPDATE.
    # La detección de duplicados en sí ya no corre aquí (ver
    # bd.views.IncidenciaViewSet.verificar_duplicado, corre ANTES de crear el
    # reporte) — esta señal solo aprende el embedding para futuras comparaciones.
    if created and instance.imagen:
        logger.info("Nueva incidencia %s creada, aprendiendo embedding.", instance.id)
        transaction.on_commit(lambda: aprender_incidencia.delay(instance.id))