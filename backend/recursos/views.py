from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Recurso
from .serializers import RecursoSerializer
from .services import liberar_recurso, asignar_recurso

class RecursoViewSet(viewsets.ModelViewSet):
    serializer_class = RecursoSerializer

    def get_queryset(self):
        return Recurso.objects.filter(
            patrocinador__usuario=self.request.user
        ).select_related('patrocinador', 'patrocinador__usuario', 'incidencia', 'incidencia__animal')

    def create(self, request, *args, **kwargs):
        # POST /api/recursos/ propios
        try:
            recurso = asignar_recurso(
                patrocinador_id=request.data.get('patrocinador_id'),
                incidencia_id=request.data.get('incidencia_id'),
                tipo=request.data.get('tipo'),
                descripcion=request.data.get('descripcion')
            )
            return Response(self.get_serializer(recurso).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            return Response(e.args[0], status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def liberar(self, request, pk=None):
        # PATCH /api/recursos/{id}/liberar/
        try:
            recurso = liberar_recurso(recurso_id=pk, usuario_solicitante=request.user)
            return Response(self.get_serializer(recurso).data, status=status.HTTP_200_OK)
        except PermissionError as e:
            return Response(e.args[0], status=status.HTTP_403_FORBIDDEN)
        except ValueError as e:
            return Response(e.args[0], status=status.HTTP_400_BAD_REQUEST)