from django.urls import path

from .views import (
    MisNotificacionesView,
    ConteoNoLeidasView,
    MarcarLeidaView,
    MarcarTodasLeidasView,
)

urlpatterns = [
    path('', MisNotificacionesView.as_view(), name='notificaciones-list'),
    path('no-leidas/', ConteoNoLeidasView.as_view(), name='notificaciones-no-leidas'),
    path('<int:notificacion_id>/leer/', MarcarLeidaView.as_view(), name='notificacion-leer'),
    path('leer-todas/', MarcarTodasLeidasView.as_view(), name='notificaciones-leer-todas'),
]