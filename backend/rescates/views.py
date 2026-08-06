import os

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError, transaction
from rest_framework.exceptions import NotFound, ValidationError, APIException, PermissionDenied
from rest_framework.permissions import AllowAny

from core.permissions import IsRescatista
from bd.models import Incidencia, PerfilRescatista
from .models import Rescate
from .serializers import RescateSerializer
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

    @transaction.atomic
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

        # 4. Manejo de Condición de Carrera (Dos rescatistas al mismo tiempo).
        # Savepoint propio: si el create() truena, no debe tumbar la transacción atómica
        # de toda la vista, solo revertir hasta aquí para poder lanzar CaseAlreadyTaken.
        try:
            with transaction.atomic():
                # Rescate.incidencia es un OneToOneField: un rescate CANCELADO sigue
                # ocupando la relación aunque el caso ya esté libre. Sin esto, un caso
                # cancelado nunca podría volver a aceptarse (IntegrityError -> 409).
                rescate_previo = Rescate.objects.filter(
                    incidencia=incidencia,
                    estado='CANCELADO',
                ).first()

                if rescate_previo:
                    # El caso fue liberado: lo reasignamos al nuevo rescatista.
                    rescate_previo.rescatista = user
                    rescate_previo.estado = 'EN_CAMINO'
                    rescate_previo.fecha_aceptacion = timezone.now()
                    rescate_previo.fecha_cierre = None
                    rescate_previo.historial.append({
                        "estado": "EN_CAMINO",
                        "timestamp": timezone.now().isoformat(),
                        "nota": "Caso retomado tras una cancelación previa.",
                    })
                    rescate_previo.save()
                    rescate = rescate_previo
                else:
                    rescate = Rescate.objects.create(
                        incidencia=incidencia,
                        rescatista=user,
                        estado='EN_CAMINO'
                    )
        except IntegrityError:
            # Si el OneToOneField de la DB detecta que ya existe, lanza IntegrityError
            raise CaseAlreadyTaken()

        # Actualizamos la incidencia
        perfil_rescatista, _ = PerfilRescatista.objects.get_or_create(usuario=user)
        incidencia.estado = 'ATENDIENDOSE'
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
    default_code = 'gps_too_far'

    def __init__(self, radio_metros):
        super().__init__(detail=f'Debes estar a menos de {radio_metros:.0f}m del reporte para cerrarlo.')


def _radio_maximo_cierre_metros():
    """Radio máximo (en metros) permitido entre el punto del reporte y el punto
    de cierre. El GPS del cierre es evidencia de a dónde fue el animal, no un
    candado por defecto: sin la variable de entorno no se valida distancia.
    Configurable vía RESCATE_CIERRE_RADIO_METROS para reactivar el límite."""
    valor = os.environ.get('RESCATE_CIERRE_RADIO_METROS')
    if not valor:
        return None
    try:
        return float(valor)
    except ValueError:
        return None


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
    ).select_related('animal', 'usuario_reporta').order_by('-urgency_score')


class ActualizarEstadoView(APIView):
    permission_classes = [IsRescatista]

    # CANCELADO ya NO se acepta aquí — tiene su propio endpoint
    # (CancelarRescateView) porque cancelar requiere efectos secundarios
    # (revertir la Incidencia a PENDIENTE, desasignar rescatista) que este
    # PATCH genérico no debe hacer.
    ESTADOS_PERMITIDOS = ['EN_SITIO', 'COMPLETADO']

    def patch(self, request, rescate_id):
        try:
            rescate = Rescate.objects.get(id=rescate_id)
        except Rescate.DoesNotExist:
            raise NotFound("Rescate no encontrado.")

        if rescate.rescatista != request.user:
            raise PermissionDenied("No tienes permiso para actualizar este rescate.")

        nuevo_estado = request.data.get('estado')
        if nuevo_estado not in self.ESTADOS_PERMITIDOS:
            raise ValidationError(
                "Estado inválido. Las opciones son EN_SITIO o COMPLETADO "
                "(para cancelar usa POST /api/rescates/{id}/cancelar/)."
            )

        # Guardamos en el campo JSONField inyectado en la Fase 1
        entrada_historial = {
            "estado": nuevo_estado,
            "timestamp": timezone.now().isoformat()
        }
        nota = request.data.get('nota')
        if nota:
            entrada_historial["nota"] = nota
        rescate.historial.append(entrada_historial)
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

        # El GPS del cierre queda como evidencia de a dónde fue el animal
        # (clínica, refugio, casa del voluntario), no como candado por
        # distancia. Por defecto no se valida; solo si se configura
        # RESCATE_CIERRE_RADIO_METROS se vuelve a exigir cercanía al reporte.
        radio_maximo = _radio_maximo_cierre_metros()
        if radio_maximo is not None:
            # .distance() en SRID 4326 devuelve grados, factorizamos a metros
            distancia = punto_cierre.distance(rescate.incidencia.ubicacion) * 111320
            if distancia > radio_maximo:
                raise GpsTooFarError(radio_maximo)

        # Actualizamos Incidencia
        rescate.incidencia.imagen = foto
        rescate.incidencia.estado = 'CERRADO'
        rescate.incidencia.save()

        # Actualizamos Rescate
        rescate.historial.append({
            "estado": "COMPLETADO",
            "timestamp": timezone.now().isoformat(),
            "ubicacion_cierre": {"lat": float(lat), "lng": float(lng)},
            "foto_cierre": request.build_absolute_uri(rescate.incidencia.imagen.url) if rescate.incidencia.imagen else None,
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


class CancelarRescateView(APIView):
    """El voluntario cancela su propio rescate ("acepté pero no puedo /
    se complicó / el animal ya no está"). A diferencia de ActualizarEstadoView,
    esto SÍ tiene efectos secundarios sobre la Incidencia: regresa a
    PENDIENTE (no se queda cerrada) y se desasigna al rescatista, para que
    el caso vuelva a aparecer en /disponibles/."""
    permission_classes = [IsRescatista]

    def post(self, request, rescate_id):
        try:
            rescate = Rescate.objects.select_related('incidencia').get(id=rescate_id)
        except Rescate.DoesNotExist:
            raise NotFound("Rescate no encontrado.")

        if rescate.rescatista != request.user:
            raise PermissionDenied("No tienes permiso para cancelar este rescate.")
        if rescate.estado == 'COMPLETADO':
            raise ValidationError("No se puede cancelar un rescate ya completado.")
        if rescate.estado == 'CANCELADO':
            raise ValidationError("Este rescate ya está cancelado.")

        motivo = request.data.get('motivo', '')

        rescate.historial.append({
            "estado": "CANCELADO",
            "timestamp": timezone.now().isoformat(),
            "motivo": motivo,
        })
        rescate.estado = 'CANCELADO'
        rescate.fecha_cierre = timezone.now()
        rescate.save()

        incidencia = rescate.incidencia
        incidencia.estado = 'PENDIENTE'
        incidencia.rescatista_asignado = None
        incidencia.save(update_fields=['estado', 'rescatista_asignado'])

        broadcast_status_changed(incidencia)

        return Response({
            "code": "rescate_cancelado",
            "detail": "Cancelaste el rescate. El caso vuelve a estar disponible.",
            "field_errors": {}
        }, status=status.HTTP_200_OK)


class MisRescatesView(ListAPIView):
    """Rescates del voluntario logueado, con el rescate_id necesario para
    actualizar estado y cerrar el caso."""
    permission_classes = [IsRescatista]
    serializer_class = RescateSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        return Rescate.objects.filter(
            rescatista=self.request.user
        ).select_related('incidencia', 'incidencia__animal').order_by('-fecha_aceptacion')


class RescateDetailView(APIView):
    """Detalle de un rescate (incluye historial) para las pantallas de
    cronología y seguimiento del voluntario."""
    permission_classes = [IsRescatista]

    def get(self, request, rescate_id):
        try:
            rescate = Rescate.objects.select_related(
                'incidencia', 'incidencia__animal'
            ).get(id=rescate_id)
        except Rescate.DoesNotExist:
            raise NotFound("Rescate no encontrado.")

        if rescate.rescatista != request.user:
            raise PermissionDenied("No tienes permiso para ver este rescate.")

        return Response(RescateSerializer(rescate).data)


class SeguimientoHistorialView(APIView):
    """Historial público (bitácora paso a paso) del rescate asociado a un
    folio, para que el reportante vea en su seguimiento cada avance del
    voluntario, no solo el estado general."""
    permission_classes = [AllowAny]

    def get(self, request, folio):
        try:
            incidencia = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            raise NotFound("Reporte no encontrado.")

        try:
            rescate = incidencia.rescate_activo
        except Rescate.DoesNotExist:
            rescate = None

        return Response({
            "folio": incidencia.folio,
            "estado": incidencia.estado,
            "historial": rescate.historial if rescate else [],
        })
