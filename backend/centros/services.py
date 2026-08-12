from django.contrib.gis.db.models.functions import Distance as DistanceFunction
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import Distance
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from bd.models import PerfilPatrocinador

from .models import PublicacionCentro, ResenaCentro, SeguidorCentro

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
    ).annotate(distancia=DistanceFunction('ubicacion_geo', punto)).order_by('distancia')


def obtener_perfil_publico(centro_id):
    try:
        return PerfilPatrocinador.objects.get(id=centro_id, estado='APROBADO')
    except PerfilPatrocinador.DoesNotExist:
        raise NotFound('El centro no existe o no esta aprobado.', code='not_found')


def obtener_centro(centro_id):
    """Para acciones del dueno (editar centro, publicaciones, responder
    resenas) — a diferencia de obtener_perfil_publico(), no filtra por
    estado: el dueno debe poder gestionar su centro aunque siga PENDIENTE
    o haya sido RECHAZADO."""
    try:
        return PerfilPatrocinador.objects.get(id=centro_id)
    except PerfilPatrocinador.DoesNotExist:
        raise NotFound('El centro no existe.', code='not_found')


def _verificar_dueno(centro, usuario):
    if centro.usuario_id != usuario.id:
        raise PermissionDenied('No eres el dueno de este centro.', code='not_owner')


@transaction.atomic
def editar_centro(centro_id, usuario, validated_data):
    centro = obtener_centro(centro_id)
    _verificar_dueno(centro, usuario)

    validated_data = dict(validated_data)
    lat = validated_data.pop('latitud', None)
    lng = validated_data.pop('longitud', None)
    if lat is not None and lng is not None:
        centro.ubicacion_geo = Point(lng, lat, srid=4326)

    for campo, valor in validated_data.items():
        setattr(centro, campo, valor)
    centro.save()
    return centro


# --- Publicaciones (mini-blog) ---------------------------------------

def listar_publicaciones(centro_id):
    centro = obtener_perfil_publico(centro_id)
    return centro.publicaciones.all()


@transaction.atomic
def crear_publicacion(centro_id, usuario, contenido, imagen=None):
    centro = obtener_centro(centro_id)
    _verificar_dueno(centro, usuario)
    return PublicacionCentro.objects.create(centro=centro, contenido=contenido, imagen=imagen)


def _obtener_publicacion_del_dueno(centro_id, post_id, usuario):
    centro = obtener_centro(centro_id)
    _verificar_dueno(centro, usuario)
    try:
        return PublicacionCentro.objects.get(id=post_id, centro=centro)
    except PublicacionCentro.DoesNotExist:
        raise NotFound('La publicacion no existe.', code='not_found')


@transaction.atomic
def editar_publicacion(centro_id, post_id, usuario, validated_data):
    publicacion = _obtener_publicacion_del_dueno(centro_id, post_id, usuario)
    for campo, valor in validated_data.items():
        setattr(publicacion, campo, valor)
    publicacion.save()
    return publicacion


@transaction.atomic
def eliminar_publicacion(centro_id, post_id, usuario):
    publicacion = _obtener_publicacion_del_dueno(centro_id, post_id, usuario)
    publicacion.delete()


# --- Resenas -----------------------------------------------------------

def listar_resenas(centro_id):
    centro = obtener_perfil_publico(centro_id)
    return centro.resenas.select_related('usuario').all()


@transaction.atomic
def crear_resena(centro_id, usuario, calificacion, comentario=''):
    centro = obtener_perfil_publico(centro_id)
    if centro.usuario_id == usuario.id:
        raise PermissionDenied('El dueno de un centro no puede resenar su propio centro.', code='not_allowed')
    if ResenaCentro.objects.filter(centro=centro, usuario=usuario).exists():
        raise ValidationError('Ya dejaste una resena para este centro.', code='resena_ya_existe')
    return ResenaCentro.objects.create(
        centro=centro, usuario=usuario, calificacion=calificacion, comentario=comentario,
    )


@transaction.atomic
def responder_resena(centro_id, resena_id, usuario, respuesta):
    centro = obtener_centro(centro_id)
    _verificar_dueno(centro, usuario)
    try:
        resena = ResenaCentro.objects.select_for_update().get(id=resena_id, centro=centro)
    except ResenaCentro.DoesNotExist:
        raise NotFound('La resena no existe.', code='not_found')
    resena.respuesta = respuesta
    resena.respuesta_fecha = timezone.now()
    resena.save(update_fields=['respuesta', 'respuesta_fecha'])
    return resena


# --- Seguidores ----------------------------------------------------------

def listar_seguidores(centro_id):
    centro = obtener_perfil_publico(centro_id)
    return centro.seguidores.select_related('usuario').all()


@transaction.atomic
def toggle_seguir(centro_id, usuario):
    """Devuelve True si al terminar la operacion el usuario sigue al
    centro, False si lo acaba de dejar de seguir."""
    centro = obtener_perfil_publico(centro_id)
    if centro.usuario_id == usuario.id:
        raise PermissionDenied('El dueno de un centro no puede seguirse a si mismo.', code='not_allowed')

    seguidor = SeguidorCentro.objects.filter(centro=centro, usuario=usuario).first()
    if seguidor:
        seguidor.delete()
        return False

    SeguidorCentro.objects.create(centro=centro, usuario=usuario)
    return True