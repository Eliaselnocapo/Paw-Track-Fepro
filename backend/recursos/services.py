from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import Recurso
from bd.models import Incidencia, PerfilPatrocinador


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

    return Recurso.objects.create(
        patrocinador=patrocinador,
        incidencia=incidencia,
        tipo=tipo,
        descripcion=descripcion,
    )


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

    return recurso
