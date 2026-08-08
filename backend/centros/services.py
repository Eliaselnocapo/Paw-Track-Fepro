from django.contrib.gis.geos import Point
from django.contrib.gis.measure import Distance
from django.db import transaction
from rest_framework.exceptions import NotFound, ValidationError

from bd.models import PerfilPatrocinador

ESTADOS_QUE_BLOQUEAN_REENVIO = ('PENDIENTE', 'APROBADO')


@transaction.atomic
def registrar_centro(usuario, validated_data):
    """Crea o reenvia (tras un RECHAZADO) la solicitud de centro de un
    usuario. Un usuario solo puede tener un PerfilPatrocinador (OneToOne),
    lo que ya garantiza que no pueda tener dos solicitudes PENDIENTE a la
    vez."""
    existente = PerfilPatrocinador.objects.filter(usuario=usuario).first()
    if existente and existente.estado in ESTADOS_QUE_BLOQUEAN_REENVIO:
        raise ValidationError(
            'Ya tienes una solicitud de centro pendiente o aprobada.',
            code='solicitud_ya_existe',
        )

    lat = validated_data.pop('latitud')
    lng = validated_data.pop('longitud')
    validated_data['ubicacion_geo'] = Point(lng, lat, srid=4326)
    validated_data.setdefault('correo', usuario.email)

    if 'PATROCINADOR' not in (usuario.roles or []):
        usuario.roles = [*(usuario.roles or []), 'PATROCINADOR']
        usuario.save(update_fields=['roles'])

    if existente:
        for campo, valor in validated_data.items():
            setattr(existente, campo, valor)
        existente.estado = 'PENDIENTE'
        existente.motivo_rechazo = ''
        existente.save()
        return existente

    return PerfilPatrocinador.objects.create(usuario=usuario, estado='PENDIENTE', **validated_data)


def mis_solicitudes(usuario):
    return PerfilPatrocinador.objects.filter(usuario=usuario)


def centros_cercanos(lat, lng, radio_km):
    punto = Point(lng, lat, srid=4326)
    return PerfilPatrocinador.objects.filter(
        estado='APROBADO',
        ubicacion_geo__distance_lte=(punto, Distance(km=radio_km)),
    ).order_by('id')


def obtener_perfil_publico(centro_id):
    try:
        return PerfilPatrocinador.objects.get(id=centro_id, estado='APROBADO')
    except PerfilPatrocinador.DoesNotExist:
        raise NotFound('El centro no existe o no esta aprobado.', code='not_found')
