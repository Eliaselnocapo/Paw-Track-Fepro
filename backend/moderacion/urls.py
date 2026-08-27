from django.urls import path

from .views import (
    ColaModeracionView,
    ReportarFraudeView,
    ResolverCentroView,
    ResolverDenunciaView,
)

urlpatterns = [
    path('incidencias/<str:folio>/reportar-fraude/', ReportarFraudeView.as_view(), name='reportar-fraude'),
    path('cola/', ColaModeracionView.as_view(), name='cola-moderacion'),
    path('denuncias/<str:folio>/resolver/', ResolverDenunciaView.as_view(), name='resolver-denuncia'),
    path('centros/<int:centro_id>/resolver/', ResolverCentroView.as_view(), name='resolver-centro'),
]
