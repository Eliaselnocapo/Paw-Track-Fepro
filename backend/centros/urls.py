from django.urls import path

from . import views

urlpatterns = [
    path('', views.RegistrarCentroView.as_view(), name='centros-registrar'),
    path('mis-solicitudes/', views.MisSolicitudesCentroView.as_view(), name='centros-mis-solicitudes'),
    path('cercanos/', views.CentrosCercanosView.as_view(), name='centros-cercanos'),
    path('<int:centro_id>/', views.CentroDetalleView.as_view(), name='centros-detalle'),
    path('<int:centro_id>/perfil/', views.CentroPerfilPublicoView.as_view(), name='centros-perfil'),
    path('<int:centro_id>/publicaciones/', views.PublicacionesCentroView.as_view(), name='centros-publicaciones'),
    path('<int:centro_id>/publicaciones/<int:post_id>/', views.PublicacionDetalleView.as_view(), name='centros-publicacion-detalle'),
    path('<int:centro_id>/resenas/', views.ResenasCentroView.as_view(), name='centros-resenas'),
    path('<int:centro_id>/resenas/<int:resena_id>/responder/', views.ResponderResenaView.as_view(), name='centros-resena-responder'),
    path('<int:centro_id>/seguidores/', views.SeguidoresCentroView.as_view(), name='centros-seguidores'),
    path('<int:centro_id>/seguir/', views.SeguirCentroView.as_view(), name='centros-seguir'),
]