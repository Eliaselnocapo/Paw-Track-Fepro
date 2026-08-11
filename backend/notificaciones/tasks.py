from celery import shared_task
from django.utils import timezone
from django.core.cache import cache

from bd.models import Incidencia, PerfilRescatista
from notificaciones.services import broadcast_urgency_update, notify_user
from core.zona import compute_zona_key


CONDICION_MAP = {"critico": 100, "herido": 70, "estable": 20}


def calcular_condicion(salud_texto):
    """Animal.salud puede traer varios valores separados por coma (ej.
    "herido, callejero"), asi que se busca por substring en vez de match
    exacto — en orden de gravedad descendente para que gane la condicion
    mas grave si el texto trae varias."""
    texto = (salud_texto or "estable").lower()
    for clave, valor in CONDICION_MAP.items():
        if clave in texto:
            return valor
    return 20


@shared_task
def recalc_urgency_score():
    incidencias = (
        Incidencia.objects.filter(estado__in=["PENDIENTE", "EN_PROCESO"])
        .select_related("animal")
    )

    for inc in incidencias:
        salud = (inc.animal.salud or "estable").lower() if inc.animal else "estable"
        condicion = calcular_condicion(salud)

        horas = (timezone.now() - inc.created_at).total_seconds() / 3600
        tiempo = min(100, horas * 8)

        # Clima y tráfico desde caché Redis; 0 si no hay valor cacheado
        clima = cache.get(f"clima_{inc.id}", 0)
        trafico = cache.get(f"trafico_{inc.id}", 0)

        new_score = min(100.0, (condicion * 0.40) + (tiempo * 0.30) + (clima * 0.15) + (trafico * 0.15))
        old_score = inc.urgency_score

        if abs(new_score - old_score) < 10:
            continue

        Incidencia.objects.filter(pk=inc.pk).update(urgency_score=new_score)
        cache.set(f"urgency_{inc.id}", new_score, timeout=35 * 60)

        lat = inc.ubicacion.y
        lng = inc.ubicacion.x
        zona_key = compute_zona_key(lat, lng)
        broadcast_urgency_update(inc.id, zona_key, new_score)

        if new_score >= 80:
            tipo_animal = inc.animal.tipo if inc.animal else None
            # Sin ubicación en tiempo real del rescatista, se notifica a todos.
            # Filtro por radio 5 km se agrega en B3 cuando exista tracking de ubicación.
            for perfil in PerfilRescatista.objects.select_related("usuario").all():
                notify_user(perfil.usuario_id, {
                    "type": "urgency_alert",
                    "tipo": "urgency_alert",
                    "reporte_id": inc.id,
                    "distancia_km": None,
                    "urgency_score": new_score,
                    "tipo_animal": tipo_animal,
                })