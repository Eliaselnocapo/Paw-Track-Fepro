from celery import shared_task
from django.utils import timezone
from django.core.cache import cache
import requests
from bd.models import Incidencia, PerfilRescatista
from notificaciones.services import broadcast_urgency_update, notify_user
from core.zona import compute_zona_key


CONDICION_MAP = {"critico": 100, "herido": 70, "estable": 20}
RADIO_VIALIDAD_M = 50
VIAS_PELIGROSAS = {
    'motorway': 100, 'trunk': 100,
    'primary': 80,
    'secondary': 60,
    'tertiary': 40,
}

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
        Incidencia.objects.filter(estado__in=["PENDIENTE", "VALIDADO"])
        .select_related("animal")
    )

    for inc in incidencias:
        salud = (inc.animal.salud or "estable").lower() if inc.animal else "estable"
        condicion = calcular_condicion(salud)

        horas = (timezone.now() - inc.created_at).total_seconds() / 3600
        tiempo = min(100, horas * 1.5)  # tope a ~66 horas en vez de 12.5

        # trafico_score se quitó de la fórmula (ver decisión de producto);
        # el campo se conserva en el modelo por si se reintroduce después,
        # pero ya no pesa en el cálculo.
        new_score = min(100.0, (condicion * 0.55) + (tiempo * 0.45))
        if (inc.trust_score or 0) < 40:
            new_score = min(new_score, 79)
        old_score = inc.urgency_score

        if abs(new_score - old_score) < 3:
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

@shared_task
def calcular_trafico(incidencia_id):
    """Consulta Overpass para saber si el reporte está junto a una vialidad
    principal. Se dispara una sola vez, al crear la incidencia.

    NOTA: trafico_score ya no se usa en recalc_urgency_score() (ver arriba),
    pero se sigue calculando y guardando por si se vuelve a necesitar más
    adelante — no cuesta nada mantenerlo actualizado.
    """
    try:
        inc = Incidencia.objects.get(pk=incidencia_id)
    except Incidencia.DoesNotExist:
        return

    if not inc.ubicacion:
        return

    lat, lng = inc.ubicacion.y, inc.ubicacion.x
    tipos = '|'.join(VIAS_PELIGROSAS.keys())

    consulta = (
        f'[out:json][timeout:15];'
        f'way["highway"~"^({tipos})$"]'
        f'(around:{RADIO_VIALIDAD_M},{lat},{lng});'
        f'out tags;'
    )

    try:
        resp = requests.post(
            'https://overpass-api.de/api/interpreter',
            data={'data': consulta},
            headers={'User-Agent': 'PawTrack/1.0 (contacto@pawtrack.app)'},
            timeout=20,
        )
        resp.raise_for_status()
        elementos = resp.json().get('elements', [])
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(
            "calcular_trafico falló para %s: %s | consulta=%s", incidencia_id, e, consulta
        )
        return

    # Gana la vía más peligrosa de las que estén cerca.
    score = 0
    for el in elementos:
        tipo = (el.get('tags') or {}).get('highway')
        score = max(score, VIAS_PELIGROSAS.get(tipo, 0))

    Incidencia.objects.filter(pk=incidencia_id).update(trafico_score=score)