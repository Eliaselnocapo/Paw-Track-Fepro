from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .serializers import (
    CentroApoyoPublicoSerializer,
    PublicacionCentroSerializer,
    ResenaCentroCrearSerializer,
    ResenaCentroSerializer,
    ResponderResenaSerializer,
    SeguidorCentroSerializer,
    SolicitudCentroApoyoSerializer,
)


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


class CentroDetalleView(APIView):
    """PATCH /api/centros/{id}/ — editar el centro ya registrado. Mismo
    shape que el registro (multipart por banner/logo), solo el dueno."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, centro_id):
        serializer = SolicitudCentroApoyoSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        centro = services.editar_centro(centro_id, request.user, serializer.validated_data)
        return Response(CentroApoyoPublicoSerializer(centro, context={'request': request}).data)


class PublicacionesCentroView(APIView):
    """GET publico (feed del mini-blog), POST solo el dueno del centro."""
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, centro_id):
        publicaciones = services.listar_publicaciones(centro_id)
        return Response(
            PublicacionCentroSerializer(publicaciones, many=True, context={'request': request}).data
        )

    def post(self, request, centro_id):
        serializer = PublicacionCentroSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        publicacion = services.crear_publicacion(
            centro_id, request.user,
            contenido=serializer.validated_data['contenido'],
            imagen=serializer.validated_data.get('imagen'),
        )
        return Response(
            PublicacionCentroSerializer(publicacion, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class PublicacionDetalleView(APIView):
    """PATCH/DELETE de una publicacion — solo el dueno del centro."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, centro_id, post_id):
        serializer = PublicacionCentroSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        publicacion = services.editar_publicacion(centro_id, post_id, request.user, serializer.validated_data)
        return Response(PublicacionCentroSerializer(publicacion, context={'request': request}).data)

    def delete(self, request, centro_id, post_id):
        services.eliminar_publicacion(centro_id, post_id, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ResenasCentroView(APIView):
    """GET publico, POST cualquier usuario logueado (que no sea el dueno)."""

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, centro_id):
        resenas = services.listar_resenas(centro_id)
        return Response(ResenaCentroSerializer(resenas, many=True, context={'request': request}).data)

    def post(self, request, centro_id):
        serializer = ResenaCentroCrearSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resena = services.crear_resena(
            centro_id, request.user,
            calificacion=serializer.validated_data['calificacion'],
            comentario=serializer.validated_data.get('comentario', ''),
        )
        return Response(
            ResenaCentroSerializer(resena, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )


class ResponderResenaView(APIView):
    """PATCH .../resenas/{id}/responder/ — solo el dueno del centro."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, centro_id, resena_id):
        serializer = ResponderResenaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resena = services.responder_resena(
            centro_id, resena_id, request.user, serializer.validated_data['respuesta'],
        )
        return Response(ResenaCentroSerializer(resena, context={'request': request}).data)


class SeguidoresCentroView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, centro_id):
        seguidores = services.listar_seguidores(centro_id)
        return Response(SeguidorCentroSerializer(seguidores, many=True, context={'request': request}).data)


class SeguirCentroView(APIView):
    """POST .../seguir/ — toggle: sigue si no lo seguia, deja de seguir si ya lo seguia."""
    permission_classes = [IsAuthenticated]

    # Arreglo de Seguir / dejar de seguir segun que hecho por yo
    def get(self, request, centro_id):
        siguiendo = services.esta_siguiendo(centro_id, request.user)
        return Response({'siguiendo': siguiendo})

    def post(self, request, centro_id):
        siguiendo = services.toggle_seguir(centro_id, request.user)
        return Response({'siguiendo': siguiendo})