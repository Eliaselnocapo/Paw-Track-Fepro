from rest_framework import status
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import CentroPendienteSerializer, IncidenciaDenunciaSerializer
from .services import listar_cola, reportar_fraude, resolver_centro, resolver_denuncia


class ReportarFraudeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folio):
        motivo = request.data.get('motivo', '')
        reportar_fraude(request.user, folio, motivo=motivo)
        return Response({
            'code': 'fraude_reportado',
            'detail': 'Reporte registrado. Gracias por ayudar a mantener la plataforma confiable.',
            'field_errors': {},
        }, status=status.HTTP_201_CREATED)


class ColaModeracionView(APIView):
    """Cola unificada del admin: denuncias de fraude ocultas + centros
    pendientes de aprobación. Solo staff (is_staff)."""
    permission_classes = [IsAdminUser]

    def get(self, request):
        denuncias, centros_pendientes = listar_cola()
        return Response({
            'denuncias': IncidenciaDenunciaSerializer(denuncias, many=True).data,
            'centros_pendientes': CentroPendienteSerializer(centros_pendientes, many=True).data,
        })


class ResolverDenunciaView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, folio):
        accion = request.data.get('accion')
        incidencia = resolver_denuncia(folio, accion)
        return Response({
            'code': 'denuncia_resuelta',
            'detail': f'Incidencia {incidencia.folio} actualizada ({accion}).',
            'field_errors': {},
        })


class ResolverCentroView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, centro_id):
        accion = request.data.get('accion')
        motivo_rechazo = request.data.get('motivo_rechazo', '')
        centro = resolver_centro(centro_id, accion, motivo_rechazo=motivo_rechazo)
        return Response({
            'code': 'centro_resuelto',
            'detail': f'Centro {centro.nombre} actualizado ({accion}).',
            'field_errors': {},
        })
