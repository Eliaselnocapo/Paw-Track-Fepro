from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsPatrocinador

from .models import Recurso
from .serializers import RecursoDeIncidenciaSerializer, RecursoSerializer
from .services import asignar_recurso, liberar_recurso, listar_recursos_de_incidencia


class RecursoViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = RecursoSerializer
    permission_classes = [IsAuthenticated, IsPatrocinador]
    http_method_names = ['get', 'post', 'patch', 'head', 'options']

    def get_queryset(self):
        return Recurso.objects.filter(
            patrocinador__usuario=self.request.user
        ).select_related(
            'patrocinador', 'patrocinador__usuario', 'incidencia', 'incidencia__animal'
        ).order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        recurso = asignar_recurso(
            usuario=request.user,
            incidencia_id=serializer.validated_data['incidencia'].id,
            tipo=serializer.validated_data['tipo'],
            descripcion=serializer.validated_data.get('descripcion', ''),
        )
        return Response(self.get_serializer(recurso).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'])
    def liberar(self, request, pk=None):
        recurso = liberar_recurso(recurso_id=pk, usuario_solicitante=request.user)
        return Response(self.get_serializer(recurso).data, status=status.HTTP_200_OK)


class RecursosDeIncidenciaView(APIView):
    """GET /api/incidencias/{folio}/recursos/ — solo lectura, solo para el
    rescatista asignado a ese caso (ver core.permissions y
    recursos.services.listar_recursos_de_incidencia)."""
    permission_classes = [IsAuthenticated]

    def get(self, request, folio):
        recursos = listar_recursos_de_incidencia(usuario=request.user, folio=folio)
        return Response(RecursoDeIncidenciaSerializer(recursos, many=True).data)