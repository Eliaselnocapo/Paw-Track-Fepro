from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import HistorialRecurso, Recurso
from bd.models import Incidencia, PerfilPatrocinador


@transaction.atomic
def asignar_recurso(usuario, incidencia_id, tipo, descripcion=''):
    try:
        patrocinador = PerfilPatrocinador.objects.get(usuario=usuario)
    except PerfilPatrocinador.DoesNotExist:
        raise PermissionDenied(
            'El usuario no tiene un perfil de patrocinador.',
            code='wrong_role',
        )

    if patrocinador.estado != 'APROBADO':
        raise PermissionDenied(
            'El patrocinador no está aprobado.',
            code='sponsor_not_approved',
        )

    try:
        incidencia = Incidencia.objects.get(id=incidencia_id)
    except Incidencia.DoesNotExist:
        raise NotFound('La incidencia no existe.', code='not_found')

    if incidencia.estado == 'CERRADO':
        raise ValidationError(
            'No se pueden asignar recursos a una incidencia cerrada.',
            code='resource_not_assignable',
        )

    recurso = Recurso.objects.create(
        patrocinador=patrocinador,
        incidencia=incidencia,
        tipo=tipo,
        descripcion=descripcion,
    )
    HistorialRecurso.objects.create(recurso=recurso, tipo_evento='ASIGNADO', actor=usuario)
    return recurso


@transaction.atomic
def liberar_recurso(recurso_id, usuario_solicitante):
    try:
        recurso = Recurso.objects.select_for_update().get(id=recurso_id)
    except Recurso.DoesNotExist:
        raise NotFound('El recurso no existe.', code='not_found')

    if recurso.patrocinador.usuario_id != usuario_solicitante.id:
        raise PermissionDenied(
            'No eres propietario del recurso.',
            code='not_owner',
        )

    incidencia = Incidencia.objects.select_for_update().get(id=recurso.incidencia_id)
    if incidencia.estado != 'CERRADO':
        raise PermissionDenied(
            'La incidencia debe estar cerrada para liberar el recurso.',
            code='resource_not_releasable',
        )

    if recurso.estado == 'LIBERADO':
        return recurso

    recurso.estado = 'LIBERADO'
    recurso.released_at = timezone.now()
    recurso.save(update_fields=['estado', 'released_at'])
    HistorialRecurso.objects.create(recurso=recurso, tipo_evento='LIBERADO', actor=usuario_solicitante)

    return recurso


def listar_recursos_de_incidencia(usuario, folio):
    try:
        incidencia = Incidencia.objects.get(folio=folio)
    except Incidencia.DoesNotExist:
        raise NotFound('La incidencia no existe.', code='not_found')

    perfil = getattr(usuario, 'perfil_rescatista', None)
    if perfil is None or incidencia.rescatista_asignado_id != perfil.id:
        raise PermissionDenied(
            'Solo el rescatista asignado a este caso puede ver sus recursos.',
            code='not_assigned_rescatista',
        )

    return Recurso.objects.filter(incidencia=incidencia).prefetch_related('historial').order_by('created_at')