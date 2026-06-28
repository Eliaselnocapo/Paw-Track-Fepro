from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from bd.views import AnimalViewSet, IncidenciaViewSet, UsuarioViewSet, GoogleLogin, LoginView

#  Creamos el Router de DRF para que arme las rutas CRUD automáticamente
router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'animales',    AnimalViewSet,    basename='animal')
router.register(r'incidencias', IncidenciaViewSet, basename='incidencia')

urlpatterns = [
    path('admin/', admin.site.urls),

    path('api/incidencias/seguimiento/<str:folio>/', IncidenciaViewSet.as_view({'get': 'seguimiento'}), name='incidencia-seguimiento'),    
    #  Rutas para el CRUD de nuestra API (ej. /api/usuarios/)
    path('api/', include(router.urls)),
    
    # Login propio (bypassa dj_rest_auth para evitar bug de refresh vacío con allauth 65)
    path('api/auth/login/', LoginView.as_view(), name='login'),
    # Logout y demás rutas de dj_rest_auth
    path('api/auth/', include('dj_rest_auth.urls')),
    
    # (Opcional por ahora) Rutas para el registro nativo de dj-rest-auth
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),

    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    path('accounts/', include('allauth.urls')),

    path('api/rescates/', include('rescates.urls')),

] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
 


if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

def pawtrack_404_handler(request, exception=None):
    """Handler global para devolver JSON en lugar de HTML cuando una ruta no existe."""
    return JsonResponse({
        "code": "not_found",
        "detail": "El recurso o endpoint solicitado no existe.",
        "field_errors": {}
    }, status=404)

handler404 = 'pawtrack.urls.pawtrack_404_handler'
