from django.urls import path

from . import views

urlpatterns = [
    path('', views.RegistrarCentroView.as_view(), name='centros-registrar'),
    path('mis-solicitudes/', views.MisSolicitudesCentroView.as_view(), name='centros-mis-solicitudes'),
    path('cercanos/', views.CentrosCercanosView.as_view(), name='centros-cercanos'),
    path('<int:centro_id>/perfil/', views.CentroPerfilPublicoView.as_view(), name='centros-perfil'),
]
