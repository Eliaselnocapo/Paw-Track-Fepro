from django.db.models.signals import post_save
from django.dispatch import receiver
from bd.models import Incidencia  # Ajusta el import según tu estructura
from deduplicacion.tasks import check_duplicados

# Esta señal "escucha" cada vez que se guarda una Incidencia
@receiver(post_save, sender=Incidencia)
def disparar_motor_vision(sender, instance, created, **kwargs):
    # 'created' es True solo cuando es un reporte NUEVO (el INSERT), no un UPDATE
    if created:
        print(f"[Signals] Nueva incidencia detectada en BD (ID: {instance.id}). Lanzando Celery...")
        # Le pasamos el ID 100% real y seguro a la cola de tareas
        print(f"DEBUG: Señal disparada para Incidencia {instance.id}")
        check_duplicados.delay(instance.id)