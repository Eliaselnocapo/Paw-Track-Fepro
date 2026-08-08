from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import CentroApoyoPublicoSerializer, SolicitudCentroApoyoSerializer


class RegistrarCentroView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        serializer = SolicitudCentroApoyoSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        centro = services.registrar_centro(request.user, dict(serializer.validated_data))
        return Response(
            CentroApoyoPublicoSerializer(centro, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class MisSolicitudesCentroView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        centros = services.mis_solicitudes(request.user)
        return Response(
            CentroApoyoPublicoSerializer(centros, many=True, context={'request': request}).data
        )


class CentrosCercanosView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        lat = request.query_params.get('lat')
        lng = request.query_params.get('lng')
        radio_km = request.query_params.get('radio_km', '10')
        if not lat or not lng:
            raise ValidationError('Se requieren los parametros lat y lng.', code='validation_error')
        try:
            centros = services.centros_cercanos(float(lat), float(lng), float(radio_km))
        except ValueError:
            raise ValidationError('lat, lng y radio_km deben ser numericos.', code='validation_error')
        return Response(
            CentroApoyoPublicoSerializer(centros, many=True, context={'request': request}).data
        )


class CentroPerfilPublicoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, centro_id):
        centro = services.obtener_perfil_publico(centro_id)
        return Response(CentroApoyoPublicoSerializer(centro, context={'request': request}).data)
