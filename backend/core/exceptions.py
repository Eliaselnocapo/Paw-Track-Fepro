from rest_framework.views import exception_handler

def pawtrack_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        # exc.detail es un ErrorDetail (str con .code) cuando se lanza con
        # code="algo_especifico" (p.ej. PermissionDenied(msg, code='not_owner')).
        # Antes esto siempre leía exc.default_code (el código genérico de la
        # clase, p.ej. 'permission_denied'), ignorando el code explícito.
        detail_code = getattr(exc.detail, 'code', None) if hasattr(exc, 'detail') else None
        code = detail_code or getattr(exc, 'default_code', 'error')
        detail = str(exc.detail) if hasattr(exc, 'detail') else str(exc)
        field_errors = {}
        if isinstance(exc.detail, dict):
            field_errors = {k: [str(e) for e in v] for k, v in exc.detail.items()}
            detail = "Errores de validación."
        response.data = {'code': code, 'detail': detail, 'field_errors': field_errors}
    return response
