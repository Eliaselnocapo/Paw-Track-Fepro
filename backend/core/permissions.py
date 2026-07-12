from rest_framework.permissions import BasePermission

class IsRescatista(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and 'RESCATISTA' in (request.user.roles or [])

class IsPatrocinador(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and 'PATROCINADOR' in (request.user.roles or [])

class IsOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.usuario_reporta_id == request.user.id

class IsSelf(BasePermission):
    """Para vistas sobre el propio modelo Usuario: solo el dueño de la
    cuenta puede editarla o eliminarla, nunca otro usuario autenticado."""
    def has_object_permission(self, request, view, obj):
        return obj.id == request.user.id

class IsAuthorOrRescatistaAsignado(BasePermission):
    """PATCH: autor mientras PENDIENTE, o rescatista asignado durante rescate."""
    def has_object_permission(self, request, view, obj):
        if obj.usuario_reporta_id == request.user.id and obj.estado == 'PENDIENTE':
            return True
        perfil = getattr(request.user, 'perfil_rescatista', None)
        return perfil is not None and obj.rescatista_asignado_id == perfil.id
