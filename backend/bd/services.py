"""Lógica de negocio de la app `bd` (usuarios, incidencias, animales)."""
from .models import Incidencia

PUNTOS_REPORTE_VALIDO = 4
PUNTOS_RESCATE_COMPLETADO = 10
PUNTOS_SEGUIMIENTO = 2
PUNTOS_POR_FRAUD_FLAG = -15
MAX_FRAUD_FLAGS_CONFIABLE = 0
MAX_FRAUD_FLAGS_REVISION = 2

ESTADOS_INCIDENCIA_INVALIDOS = {'CANCELADO'}


def _estado_validacion(estado_incidencia: str) -> str:
    if estado_incidencia == 'CERRADO':
        return 'validado'
    return 'pendiente'


def calcular_reputacion(usuario) -> dict:
    from rescates.models import Rescate

    incidencias = Incidencia.objects.filter(usuario_reporta=usuario)
    reportes_totales = incidencias.count()
    reportes_invalidos = incidencias.filter(estado__in=ESTADOS_INCIDENCIA_INVALIDOS).count()
    reportes_validos = reportes_totales - reportes_invalidos

    rescates = Rescate.objects.filter(rescatista=usuario).select_related('incidencia')
    rescates_aceptados = rescates.count()
    rescates_completados = rescates.filter(estado='COMPLETADO').count()
    seguimientos = sum(len(r.historial or []) for r in rescates)

    fraud_flags = usuario.fraud_flags or 0
    impacto_fraude = fraud_flags * PUNTOS_POR_FRAUD_FLAG

    score = min(100, max(0, (
    reportes_validos * PUNTOS_REPORTE_VALIDO
    + rescates_completados * PUNTOS_RESCATE_COMPLETADO
    + seguimientos * PUNTOS_SEGUIMIENTO
    + impacto_fraude
    )))

    timeline = []
    for inc in incidencias.order_by('-created_at')[:20]:
        timeline.append({
            'tipo': 'reporte',
            'titulo': f'Reportaste un caso: {inc.get_tipo_incidencia_display()}',
            'fecha': inc.created_at.isoformat(),
        })
    for r in rescates.order_by('-fecha_aceptacion')[:20]:
        timeline.append({
            'tipo': 'aceptado',
            'titulo': f'Aceptaste el caso {r.incidencia.folio}',
            'fecha': r.fecha_aceptacion.isoformat(),
        })
        if r.estado == 'COMPLETADO' and r.fecha_cierre:
            timeline.append({
                'tipo': 'cerrado',
                'titulo': f'Completaste el caso {r.incidencia.folio}',
                'fecha': r.fecha_cierre.isoformat(),
            })
        for entrada in (r.historial or []):
            timestamp = entrada.get('timestamp')
            if not timestamp:
                continue
            timeline.append({
                'tipo': 'seguimiento',
                'titulo': f"Actualizaste el caso {r.incidencia.folio} a {entrada.get('estado', '')}",
                'fecha': timestamp,
            })
    timeline.sort(key=lambda item: item['fecha'], reverse=True)
    timeline = timeline[:20]

    historial_casos = []
    for inc in incidencias.order_by('-created_at')[:10]:
        historial_casos.append({
            'folio': inc.folio,
            'tipo': inc.get_tipo_incidencia_display(),
            'estado': _estado_validacion(inc.estado),
            'fraudFlags': 0,
            'urgencyMultiplier': 1.0,
            'impactoPuntos': PUNTOS_REPORTE_VALIDO if inc.estado not in ESTADOS_INCIDENCIA_INVALIDOS else 0,
        })
    for r in rescates.order_by('-fecha_aceptacion')[:10]:
        historial_casos.append({
            'folio': r.incidencia.folio,
            'tipo': 'Rescate completado' if r.estado == 'COMPLETADO' else 'Rescate aceptado',
            'estado': 'validado' if r.estado == 'COMPLETADO' else 'pendiente',
            'fraudFlags': 0,
            'urgencyMultiplier': 1.0,
            'impactoPuntos': PUNTOS_RESCATE_COMPLETADO if r.estado == 'COMPLETADO' else 0,
        })

    return {
        'reportesTotales': reportes_totales,
        'reportesValidos': reportes_validos,
        'rescatesAceptados': rescates_aceptados,
        'rescatesCompletados': rescates_completados,
        'seguimientos': seguimientos,
        'score': score,
        'impactoFraude': impacto_fraude,
        'timeline': timeline,
        'historialCasos': historial_casos,
    }
def evaluar_confianza_reporte(usuario) -> tuple[str, float]:
    """Decide el estado inicial de una incidencia y su trust_score, según el
    historial de fraude de quien la reporta.

    Devuelve (estado, trust_score).

    Un reporte NUNCA se oculta por esto: PENDIENTE sigue siendo visible para
    los voluntarios. Lo que cambia es si puede escalar en urgencia y disparar
    notificaciones — un animal real no debe quedarse sin ayuda por el
    historial de quien lo reportó (ver §11 del documento, riesgo de falsos
    positivos marcado como probabilidad alta).
    """
    # Anónimo: no hay historial que consultar. Entra sin escalar hasta que
    # alguien lo reclame con el cartel PDF (ver IncidenciaViewSet.reclamar).
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        return 'PENDIENTE', 50.0

    flags = usuario.fraud_flags or 0

    if flags <= MAX_FRAUD_FLAGS_CONFIABLE:
        return 'VALIDADO', 80.0

    if flags <= MAX_FRAUD_FLAGS_REVISION:
        return 'PENDIENTE', 40.0

    # Historial de fraude confirmado: entra, pero marcado.
    return 'PENDIENTE', 15.0

def calcular_reputacion_resumen(usuario) -> dict:
    """Versión ligera de calcular_reputacion, solo el score — para mostrar
    en tarjetas pequeñas (detalle de caso) sin cargar timeline/historial."""
    from rescates.models import Rescate

    incidencias = Incidencia.objects.filter(usuario_reporta=usuario)
    reportes_totales = incidencias.count()
    reportes_invalidos = incidencias.filter(estado__in=ESTADOS_INCIDENCIA_INVALIDOS).count()
    reportes_validos = reportes_totales - reportes_invalidos

    rescates = Rescate.objects.filter(rescatista=usuario)
    rescates_completados = rescates.filter(estado='COMPLETADO').count()
    seguimientos = sum(len(r.historial or []) for r in rescates)

    fraud_flags = usuario.fraud_flags or 0
    impacto_fraude = fraud_flags * PUNTOS_POR_FRAUD_FLAG

    score = max(0, (
        reportes_validos * PUNTOS_REPORTE_VALIDO
        + rescates_completados * PUNTOS_RESCATE_COMPLETADO
        + seguimientos * PUNTOS_SEGUIMIENTO
        + impacto_fraude
    ))

    return {'score': score, 'reportesValidos': reportes_validos}