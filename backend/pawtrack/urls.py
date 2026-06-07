from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from bd.views import UsuarioViewSet, GoogleLogin
from django.conf import settings
from django.conf.urls.static import static

#  Creamos el Router de DRF para que arme las rutas CRUD automáticamente
router = DefaultRouter()
router.register(r'usuarios', UsuarioViewSet, basename='usuario')

urlpatterns = [
    path('admin/', admin.site.urls),
    
    #  Rutas para el CRUD de nuestra API (ej. /api/usuarios/)
    path('api/', include(router.urls)),
    
    #  Rutas oficiales para el Login/Logout (Devuelven el Token JWT)
    # ej. /api/auth/login/
    path('api/auth/', include('dj_rest_auth.urls')),
    
    # (Opcional por ahora) Rutas para el registro nativo de dj-rest-auth
    path('api/auth/registration/', include('dj_rest_auth.registration.urls')),

    path('api/auth/google/', GoogleLogin.as_view(), name='google_login'),

    path('accounts/', include('allauth.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
