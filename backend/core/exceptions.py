from rest_framework.views import exception_handler


def _extraer_code(detail):
    """Busca .code recursivamente. DRF le pega .code al ErrorDetail hoja,
    nunca al list/dict contenedor — por eso getattr(exc.detail, 'code', None)
    da None para cualquier ValidationError con detail no-escalar (la forma
    que produce serializer.errors, un dict)."""
    if isinstance(detail, list) and detail:
        return _extraer_code(detail[0])
    if isinstance(detail, dict) and detail:
        return _extraer_code(next(iter(detail.values())))
    return getattr(detail, 'code', None)


def pawtrack_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        # exc.detail es un ErrorDetail (str con .code) cuando se lanza con
        # code="algo_especifico" (p.ej. PermissionDenied(msg, code='not_owner')).
        # Antes esto siempre leía exc.default_code (el código genérico de la
        # clase, p.ej. 'permission_denied'), ignorando el code explícito.
        detail_code = _extraer_code(exc.detail) if hasattr(exc, 'detail') else None
        code = detail_code or getattr(exc, 'default_code', 'error')
        raw_detail = exc.detail if hasattr(exc, 'detail') else exc
        if isinstance(raw_detail, list):
            # ValidationError('mensaje', code='x') llega aqui como una lista
            # de un ErrorDetail (asi lo envuelve DRF internamente) — sin este
            # join, str(raw_detail) mostraba el repr crudo de la lista
            # ("[ErrorDetail(string='mensaje', code='x')]") en vez del mensaje.
            detail = ' '.join(str(item) for item in raw_detail)
        else:
            detail = str(raw_detail)
        field_errors = {}
        if isinstance(exc.detail, dict):
            field_errors = {k: [str(e) for e in v] for k, v in exc.detail.items()}
            detail = "Errores de validación."
        response.data = {'code': code, 'detail': detail, 'field_errors': field_errors}
    return response