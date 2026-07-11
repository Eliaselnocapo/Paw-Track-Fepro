import os
from datetime import timedelta

from django.contrib.gis.db.models.functions import Distance
from django.contrib.gis.measure import D
from django.db.models import Q
from django.utils import timezone

from bd.models import Incidencia

ESTADOS_CERRADOS = ['CERRADO', 'RESUELTO']


def _radio_metros():
    return float(os.environ.get('DEDUP_RADIO_METROS', 10000))


def _ventana_dias():
    return float(os.environ.get('DEDUP_VENTANA_DIAS', 60))


def filtrar_candidatos_geograficos(incidencia, radio_metros=None):
    """
    Etapa 1 del pipeline: descarta cualquier incidencia fuera del radio y las
    que ya están CERRADO/RESUELTO. El radio se envuelve en D(m=...) porque
    Incidencia.ubicacion es un PointField srid=4326 (coordenadas geográficas
    en grados) — pasar un número crudo aquí se interpreta en grados, no
    metros (bug real que traía tasks.py antes de este fix).
    Anota `distancia_m` (metros reales) para que ranking.py no tenga que
    recalcular la distancia con GEOSGeometry.distance(), que también da
    grados en vez de metros para este mismo campo.
    """
    radio = radio_metros if radio_metros is not None else _radio_metros()
    fecha_limite = timezone.now() - timedelta(days=_ventana_dias())

    return Incidencia.objects.filter(
        ubicacion__distance_lte=(incidencia.ubicacion, D(m=radio)),
        created_at__gte=fecha_limite,
    ).exclude(id=incidencia.id).exclude(estado__in=ESTADOS_CERRADOS).annotate(
        distancia_m=Distance('ubicacion', incidencia.ubicacion)
    )


def filtrar_por_estructura(candidatos_qs, animal):
    """
    Etapa 2: descarta por tipo (obligatorio, nunca cruza especie) y, solo
    cuando ambos lados reportan el dato, por raza/tamaño. Son campos de
    texto libre capturados por el reportante, así que un valor vacío no
    descarta — solo se excluye ante un choque explícito entre dos valores
    conocidos.
    """
    candidatos_qs = candidatos_qs.filter(animal__tipo__iexact=animal.tipo)

    if animal.tamano:
        candidatos_qs = candidatos_qs.filter(Q(animal__tamano__iexact=animal.tamano) | Q(animal__tamano=''))
    if animal.raza:
        candidatos_qs = candidatos_qs.filter(Q(animal__raza__iexact=animal.raza) | Q(animal__raza=''))

    return candidatos_qs


def candidatos_por_metadatos(incidencia):
    """Punto de entrada del orquestador: filtros baratos (geo + estructura) antes de VisionService."""
    if incidencia.ubicacion is None or incidencia.animal is None:
        return Incidencia.objects.none()

    candidatos = filtrar_candidatos_geograficos(incidencia)
    return filtrar_por_estructura(candidatos, incidencia.animal)
