from rest_framework.views import exception_handler

def pawtrack_exception_handler(exc, context):
    response = exception_handler(exc, context)
    if response is not None:
        code = getattr(exc, 'default_code', 'error')
        detail = str(exc.detail) if hasattr(exc, 'detail') else str(exc)
        field_errors = {}
        if isinstance(exc.detail, dict):
            field_errors = {k: [str(e) for e in v] for k, v in exc.detail.items()}
            detail = "Errores de validación."
        response.data = {'code': code, 'detail': detail, 'field_errors': field_errors}
    return response
