from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from core.zona import compute_zona_key

_layer = get_channel_layer()


def notify_zona(zona_key: str, event: dict):
    async_to_sync(_layer.group_send)(f"mapa_{zona_key}", event)


def notify_user(uid: int, event: dict):
    async_to_sync(_layer.group_send)(f"notif_{uid}", event)


def broadcast_new_report(incidencia):
    if not incidencia.ubicacion:
        return
    lat = incidencia.ubicacion.y
    lng = incidencia.ubicacion.x
    zona_key = compute_zona_key(lat, lng)
    notify_zona(zona_key, {
        "type": "new_report",
        "tipo": "new_report",
        "id": incidencia.id,
        "lat": lat,
        "lng": lng,
        "tipo_animal": incidencia.animal.tipo if incidencia.animal else None,
        "urgency_score": incidencia.urgency_score,
        "estado": incidencia.estado,
    })


def broadcast_status_changed(incidencia):
    if not incidencia.ubicacion:
        return
    lat = incidencia.ubicacion.y
    lng = incidencia.ubicacion.x
    zona_key = compute_zona_key(lat, lng)
    notify_zona(zona_key, {
        "type": "status_changed",
        "tipo": "status_changed",
        "id": incidencia.id,
        "estado": incidencia.estado,
        "rescatista_asignado": incidencia.rescatista_asignado_id,
    })


def broadcast_duplicate_detected(incidencia, original):
    if not incidencia.usuario_reporta_id:
        return  # reporte anónimo: no hay canal /ws/notif/{uid}/ al cual avisarle
    notify_user(incidencia.usuario_reporta_id, {
        "type": "duplicate_detected",
        "tipo": "duplicate_detected",
        "id": incidencia.id,
        "folio": incidencia.folio,
        "duplicado_de": original.id,
        "duplicado_de_folio": original.folio,
    })




def broadcast_rescate_update(rescate_id: int, event: dict):
    async_to_sync(_layer.group_send)(f"rescate_{rescate_id}", event)


def broadcast_urgency_update(incidencia_id: int, zona_key: str, nuevo_score: float):
    notify_zona(zona_key, {
        "type": "urgency_update",
        "tipo": "urgency_update",
        "id": incidencia_id,
        "urgency_score": nuevo_score,
    })
def crear_notificacion(usuario_id, tipo, titulo, mensaje='', enlace=''):
    """Guarda la notificación y la emite por WebSocket si el usuario está
    conectado. Las vistas deben llamar a esta, no a notify_user directo:
    de lo contrario el aviso se pierde para quien no esté en línea.
    """
    from .models import Notificacion

    if not usuario_id:
        return None

    notif = Notificacion.objects.create(
        usuario_id=usuario_id,
        tipo=tipo,
        titulo=titulo,
        mensaje=mensaje,
        enlace=enlace,
    )

    notify_user(usuario_id, {
        'type': 'notificacion',
        'tipo': tipo,
        'id': notif.id,
        'titulo': titulo,
        'mensaje': mensaje,
        'enlace': enlace,
        'created_at': notif.created_at.isoformat(),
    })

    return notif