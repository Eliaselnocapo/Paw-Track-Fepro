from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError
from rest_framework.exceptions import NotFound, ValidationError, APIException, PermissionDenied

from core.permissions import IsRescatista
from bd.models import Incidencia, PerfilRescatista
from .models import Rescate
from notificaciones.services import broadcast_status_changed

from rest_framework.generics import ListAPIView
from django.contrib.gis.geos import Point
from django.contrib.gis.measure import Distance
from django.utils import timezone

from core.pagination import StandardPagination
from bd.serializers import IncidenciaSerializer

# Excepción personalizada para el handler global (409 Conflict)
class CaseAlreadyTaken(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Este caso ya fue aceptado por otro rescatista.'
    default_code = 'case_already_taken'


class AceptarRescateView(APIView):
    # 1. Delegamos la validación del rol al permiso centralizado
    permission_classes = [IsRescatista]

    def post(self, request, folio):
        user = request.user
        
        # 2. Búsqueda con raise NotFound (El handler global lo atrapa)
        try:
            incidencia = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            raise NotFound("Incidencia no encontrada.")

        # 3. Validación de estado con raise ValidationError
        if incidencia.estado != 'PENDIENTE':
            raise ValidationError(f"La incidencia ya no está disponible. Estado actual: {incidencia.estado}")

        # 4. Manejo de Condición de Carrera (Dos rescatistas al mismo tiempo)
        try:
            rescate = Rescate.objects.create(
                incidencia=incidencia,
                rescatista=user,
                estado='EN_CAMINO'
            )
        except IntegrityError:
            # Si el OneToOneField de la DB detecta que ya existe, lanza IntegrityError
            raise CaseAlreadyTaken()
        
        # Actualizamos la incidencia
        incidencia.estado = 'ATENDIENDOSE'
        perfil_rescatista = PerfilRescatista.objects.get(usuario=user)
        incidencia.rescatista_asignado = perfil_rescatista
        incidencia.save()

        # 5. Disparar el WebSocket para que el mapa en F4 se actualice en tiempo real
        broadcast_status_changed(incidencia)

        # 6. Respuesta con el contrato exacto esperado
        return Response({
            "code": "rescate_aceptado",
            "detail": "Rescate aceptado exitosamente.",
            "field_errors": {}
        }, status=status.HTTP_201_CREATED)

class MissingCoordsError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Se requieren las coordenadas lat y lng en los parámetros.'
    default_code = 'missing_coords'

class GpsTooFarError(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'Debes estar a menos de 100m del reporte para cerrarlo.'
    default_code = 'gps_too_far'


# --- Nuevas Vistas ---

class DisponiblesView(ListAPIView):
    permission_classes = [IsRescatista]
    serializer_class = IncidenciaSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        lat = self.request.query_params.get('lat')
        lng = self.request.query_params.get('lng')

        if not lat or not lng:
            raise MissingCoordsError()

        try:
            punto = Point(float(lng), float(lat), srid=4326)
        except ValueError:
            raise ValidationError("Coordenadas inválidas. Deben ser numéricas.")

        # Magia PostGIS: filtramos PENDIENTE y calculamos la distancia geométrica en un solo query
        return Incidencia.objects.filter(
            estado='PENDIENTE',
            ubicacion__distance_lte=(punto, Distance(km=10))
        ).order_by('-urgency_score')


class ActualizarEstadoView(APIView):
    permission_classes = [IsRescatista]

    def patch(self, request, rescate_id):
        try:
            rescate = Rescate.objects.get(id=rescate_id)
        except Rescate.DoesNotExist:
            raise NotFound("Rescate no encontrado.")

        if rescate.rescatista != request.user:
            raise PermissionDenied("No tienes permiso para actualizar este rescate.")

        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in ['COMPLETADO', 'CANCELADO']:
            raise ValidationError("Estado inválido. Las opciones son COMPLETADO o CANCELADO.")

        # Guardamos en el campo JSONField inyectado en la Fase 1
        rescate.historial.append({
            "estado": nuevo_estado,
            "timestamp": timezone.now().isoformat()
        })
        rescate.estado = nuevo_estado
        rescate.save()

        broadcast_status_changed(rescate.incidencia)

        return Response({
            "code": "estado_actualizado",
            "detail": f"Estado del rescate actualizado a {nuevo_estado}.",
            "field_errors": {}
        }, status=status.HTTP_200_OK)


class CerrarRescateView(APIView):
    permission_classes = [IsRescatista]

    def post(self, request, rescate_id):
        try:
            rescate = Rescate.objects.get(id=rescate_id)
        except Rescate.DoesNotExist:
            raise NotFound("Rescate no encontrado.")

        if rescate.rescatista != request.user:
            raise PermissionDenied("No tienes permiso para cerrar este rescate.")

        lat = request.data.get('lat')
        lng = request.data.get('lng')
        foto = request.FILES.get('foto')

        if not lat or not lng:
            raise ValidationError("Faltan coordenadas GPS actuales para cerrar el caso.")
        if not foto:
            raise ValidationError("La foto de evidencia es obligatoria para el cierre.")

        try:
            punto_cierre = Point(float(lng), float(lat), srid=4326)
        except ValueError:
            raise ValidationError("Coordenadas inválidas.")

        # Verificación estricta de 100m (.distance() en SRID 4326 devuelve grados, factorizamos a metros)
        distancia = punto_cierre.distance(rescate.incidencia.ubicacion)
        if (distancia * 111320) > 100:
            raise GpsTooFarError()

        # Actualizamos Incidencia
        rescate.incidencia.imagen = foto
        rescate.incidencia.estado = 'CERRADO'
        rescate.incidencia.save()

        # Actualizamos Rescate
        rescate.historial.append({
            "estado": "COMPLETADO",
            "timestamp": timezone.now().isoformat()
        })
        rescate.estado = 'COMPLETADO'
        rescate.fecha_cierre = timezone.now()
        rescate.save()

        broadcast_status_changed(rescate.incidencia)

        return Response({
            "code": "rescate_cerrado",
            "detail": "Rescate documentado y cerrado exitosamente.",
            "field_errors": {}
        }, status=status.HTTP_200_OK)
