from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from bd.models import Incidencia, PerfilPatrocinador
from .models import ReporteFraude

UMBRAL_OCULTAMIENTO = 3


@transaction.atomic
def reportar_fraude(usuario, folio, motivo=''):
    """Un usuario autenticado denuncia una incidencia ajena como falsa o de
    mal uso. Máximo un reporte por usuario por incidencia (constraint de
    BD). Al llegar a UMBRAL_OCULTAMIENTO denuncias únicas (o más — varias
    pueden llegar casi al mismo tiempo), la incidencia se oculta de
    mapa/disponibles hasta que un admin la resuelva (ver resolver_denuncia)."""
    try:
        incidencia = Incidencia.objects.select_for_update().get(folio=folio)
    except Incidencia.DoesNotExist:
        raise NotFound('La incidencia no existe.', code='not_found')

    if incidencia.usuario_reporta_id == usuario.id:
        raise PermissionDenied(
            'No puedes reportar tu propio caso.', code='cannot_report_own_case',
        )

    try:
        ReporteFraude.objects.create(
            incidencia=incidencia, usuario_reporta=usuario, motivo=motivo,
        )
    except IntegrityError:
        raise ValidationError(
            'Ya reportaste esta incidencia como fraude.', code='fraude_ya_reportado',
        )

    incidencia.reportes_fraude_count += 1
    update_fields = ['reportes_fraude_count']

    if incidencia.reportes_fraude_count >= UMBRAL_OCULTAMIENTO and not incidencia.oculto_por_fraude:
        incidencia.oculto_por_fraude = True
        update_fields.append('oculto_por_fraude')

    incidencia.save(update_fields=update_fields)
    return incidencia


def listar_cola():
    """Cola unificada del admin: denuncias ocultas por fraude pendientes de
    resolver + solicitudes de centro de apoyo pendientes de aprobación."""
    denuncias = (
        Incidencia.objects.filter(oculto_por_fraude=True)
        .select_related('animal', 'usuario_reporta')
        .prefetch_related('reportes_fraude')
        .order_by('-reportes_fraude_count', '-updated_at')
    )
    centros_pendientes = (
        PerfilPatrocinador.objects.filter(estado='PENDIENTE')
        .select_related('usuario')
        .order_by('created_at')
    )
    return denuncias, centros_pendientes


@transaction.atomic
def resolver_denuncia(folio, accion):
    """`descartar`: el admin revisó y el caso es legítimo — vuelve a ser
    visible normal, sale de la cola, y el contador de denuncias se reinicia
    a 0 (las denuncias ya reportadas quedan en el historial de auditoría,
    pero no vuelven a contar para el umbral). Así, si el caso vuelve a
    recibir denuncias más adelante, el umbral se evalúa desde cero en vez
    de quedar permanentemente atorado por encima de UMBRAL_OCULTAMIENTO.
    `confirmar_fraude`: el admin confirmó que es falso — queda
    `DESESTIMADO` (terminal) y sigue oculto."""
    try:
        incidencia = Incidencia.objects.select_for_update().get(folio=folio)
    except Incidencia.DoesNotExist:
        raise NotFound('La incidencia no existe.', code='not_found')

    if accion == 'descartar':
        incidencia.oculto_por_fraude = False
        incidencia.reportes_fraude_count = 0
        incidencia.save(update_fields=['oculto_por_fraude', 'reportes_fraude_count'])
    elif accion == 'confirmar_fraude':
        incidencia.estado = 'DESESTIMADO'
        incidencia.oculto_por_fraude = True
        incidencia.save(update_fields=['estado', 'oculto_por_fraude'])
    else:
        raise ValidationError(
            'accion debe ser "descartar" o "confirmar_fraude".', code='accion_invalida',
        )

    return incidencia


@transaction.atomic
def resolver_centro(centro_id, accion, motivo_rechazo=''):
    try:
        centro = PerfilPatrocinador.objects.select_for_update().get(id=centro_id)
    except PerfilPatrocinador.DoesNotExist:
        raise NotFound('El centro no existe.', code='not_found')

    if accion == 'aprobar':
        centro.estado = 'APROBADO'
        centro.motivo_rechazo = ''
        centro.save(update_fields=['estado', 'motivo_rechazo'])
    elif accion == 'rechazar':
        centro.estado = 'RECHAZADO'
        centro.motivo_rechazo = motivo_rechazo
        centro.save(update_fields=['estado', 'motivo_rechazo'])
    else:
        raise ValidationError(
            'accion debe ser "aprobar" o "rechazar".', code='accion_invalida',
        )

    return centro
