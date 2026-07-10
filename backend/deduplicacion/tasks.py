from celery import shared_task
from bd.models import Incidencia 
from deduplicacion.services import VisionService
from django.contrib.gis.geos import Point
from django.contrib.gis.db.models.functions import Distance
from django.utils import timezone
from datetime import timedelta

@shared_task
def check_duplicados(incidencia_id):
    try:
        nueva_incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        return "Incidencia no encontrada"

    # 1. La imagen vive en el modelo Incidencia, no en Animal
    if not nueva_incidencia.imagen:
        return "Sin imagen, omitiendo deduplicación"

    radio_metros = 10000 
    fecha_limite = timezone.now() - timedelta(days=60)
    
    candidatos = Incidencia.objects.filter(
        ubicacion__distance_lte=(nueva_incidencia.ubicacion, radio_metros),
        created_at__gte=fecha_limite
    ).exclude(id=nueva_incidencia.id)    

    candidatos = candidatos.filter(animal__tipo=nueva_incidencia.animal.tipo)

    if not candidatos.exists():
        return "No se encontraron candidatos tras el filtro geográfico y de especie."

    candidatos_ids = list(candidatos.values_list('id', flat=True))

    print(f"[Celery] Iniciando búsqueda visual para reporte {nueva_incidencia.id}...")

    vision_ai = VisionService()

    # 2. Extraer la ruta de la imagen y la especie del animal asociado
    # nueva_incidencia.imagen.path es el campo real de Django para el archivo
    duplicados = vision_ai.process_new_report(
        image_file=nueva_incidencia.imagen.path, 
        especie=nueva_incidencia.animal.tipo, 
        db_id=nueva_incidencia.id,
        candidatos_ids=candidatos_ids
    )

    if not duplicados:
        return "No se encontraron coincidencias."

    print(f"[Celery] Posibles duplicados visuales encontrados: {duplicados}")
    return f"Búsqueda finalizada. Top visual: {duplicados}"