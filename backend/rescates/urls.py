from django.urls import path
from .views import AceptarRescateView

urlpatterns = [
    path('aceptar/<str:folio>/', AceptarRescateView.as_view(), name='aceptar-rescate'),
]
