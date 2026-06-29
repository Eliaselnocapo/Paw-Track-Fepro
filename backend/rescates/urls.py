from django.urls import path
from .views import (
    AceptarRescateView, 
    DisponiblesView, 
    ActualizarEstadoView, 
    CerrarRescateView
)

urlpatterns = [
    path('disponibles/', DisponiblesView.as_view(), name='rescates-disponibles'),
    path('aceptar/<str:folio>/', AceptarRescateView.as_view(), name='aceptar-rescate'),
    path('<int:rescate_id>/estado/', ActualizarEstadoView.as_view(), name='actualizar-estado-rescate'),
    path('<int:rescate_id>/cerrar/', CerrarRescateView.as_view(), name='cerrar-rescate'),
]
