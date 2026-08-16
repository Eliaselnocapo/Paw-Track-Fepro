from django.contrib import admin
from django.urls import path, re_path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from bd.views import AnimalViewSet, IncidenciaViewSet, UsuarioViewSet, GoogleLogin, LoginView, MiPerfilView, ProcesarCartelPDFView
from rescates.views import SeguimientoHistorialView #RecursosDeIncidenciaView


#  Creamos el Router de DRF para que arme las rutas CRUD automáticamente
router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')
router.register(r'animales',    AnimalViewSet,    basename='animal')
router.register(r'incidencias', IncidenciaViewSet, basename='incidencia')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path('api/procesar-pdf-externo/', ProcesarCartelPDFView.as_view(), name='procesar_pdf'),
    
    path('api/incidencias/seguimiento/<str:folio>/', IncidenciaViewSet.as_view({'get': 'seguimiento'}), name='incidencia-seguimiento'),
    path('api/incidencias/seguimiento/<str:folio>/historial/', SeguimientoHistorialView.as_view(), name='incidencia-seguimiento-historial'),
    # path('api/incidencias/<str:folio>/recursos/', RecursosDeIncidenciaView.as_view(), name='incidencia-recursos'),
    #  Rutas para el CRUD de nuestra API (ej. /api/usuarios/)
    path('api/', include(router.urls)),
    
    # Login propio (bypassa dj_rest_auth para evitar bug de refresh vacío con allauth 65)
    path('api/auth/login/', LoginView.as_view(), name='login'),
    # Perfil propio: registrada ANTES del include de abajo para tomar precedencia
    # sobre la vista por defecto de dj_rest_auth (que permitía cambiar
    # email/roles y corrompía la contraseña al editar el perfil, ver MiPerfilView).
    # re_path con slash opcional porque dj_rest_auth registra su 'user/?$'
    # también así — con path() normal, la variante SIN slash final se cuela
    # hasta su vista insegura sin pasar por esta. Nombre distinto a
    # 'rest_user_details' (el que usa dj_rest_auth) a propósito: si
    # compartieran nombre, reverse() puede resolver a la vista equivocada.
    re_path(r'^api/auth/user/?$', MiPerfilView.as_view(), name='mi-perfil'),
    # Logout y demás rutas de dj_rest_auth
    path('api/auth/', include('dj_rest_auth.urls')),
    
    # (Opcional por ahora) Rutas para el registro nativo de dj-rest-auth
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),

    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    path('accounts/', include('allauth.urls')),

    path('api/rescates/', include('rescates.urls')),
    path('api/recursos/', include('recursos.urls')),
    path('api/centros/', include('centros.urls')),
    path('api/notificaciones/', include('notificaciones.urls')),
] 
 


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
