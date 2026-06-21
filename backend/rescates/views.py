from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from bd.models import Incidencia, PerfilRescatista
from .models import Rescate

class AceptarRescateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, folio):
        user = request.user
        
        #  Validar que el usuario sea rescatista
        if 'RESCATISTA' not in (user.roles or []):
            return Response(
                {"error": "Solo los usuarios con rol de RESCATISTA pueden aceptar incidencias."},
                status=status.HTTP_403_FORBIDDEN
            )

        #  Buscar la incidencia
        try:
            incidencia = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            return Response({"error": "Incidencia no encontrada."}, status=status.HTTP_404_NOT_FOUND)

        #  Validar que la incidencia siga PENDIENTE
        if incidencia.estado != 'PENDIENTE':
            return Response(
                {"error": f"La incidencia ya no está disponible. Estado actual: {incidencia.estado}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        #  Crear el rescate y actualizar la incidencia
        rescate = Rescate.objects.create(
            incidencia=incidencia,
            rescatista=user,
            estado='EN_CAMINO'
        )
        
        # Actualizamos la incidencia
        incidencia.estado = 'ATENDIENDOSE'
        perfil_rescatista = PerfilRescatista.objects.get(usuario=user)
        incidencia.rescatista_asignado = perfil_rescatista
        incidencia.save()

        return Response({
            "mensaje": "Rescate aceptado exitosamente.",
            "rescate_id": rescate.id,
            "incidencia_folio": incidencia.folio,
            "estado_incidencia": incidencia.estado
        }, status=status.HTTP_201_CREATED)
