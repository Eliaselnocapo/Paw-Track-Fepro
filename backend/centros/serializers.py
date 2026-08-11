import json

from rest_framework import serializers

from bd.models import PerfilPatrocinador, Usuario

from .models import PublicacionCentro, ResenaCentro, SeguidorCentro


class JSONEnMultipartField(serializers.JSONField):
    """El registro de centro llega como multipart/form-data (por las
    imagenes de banner/logo), asi que formas_ayuda y redes_sociales llegan
    como string JSON dentro del form en vez de JSON anidado normal."""

    def to_internal_value(self, data):
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except ValueError:
                raise serializers.ValidationError('Debe ser un JSON valido.')
        return super().to_internal_value(data)


class SolicitudCentroApoyoSerializer(serializers.ModelSerializer):
    latitud = serializers.FloatField(write_only=True)
    longitud = serializers.FloatField(write_only=True)
    formas_ayuda = JSONEnMultipartField(required=False, default=list)
    redes_sociales = JSONEnMultipartField(required=False, default=dict)

    class Meta:
        model = PerfilPatrocinador
        fields = (
            'nombre', 'tipo', 'direccion', 'latitud', 'longitud', 'telefono',
            'horario', 'sitio_web', 'descripcion', 'banner', 'logo',
            'mision', 'vision', 'formas_ayuda', 'redes_sociales',
        )
        extra_kwargs = {
            'horario':     {'required': False, 'allow_blank': True, 'default': ''},
            'sitio_web':   {'required': False, 'allow_blank': True, 'default': ''},
            'descripcion': {'required': False, 'allow_blank': True, 'default': ''},
            'banner':      {'required': False},
            'logo':        {'required': False},
            'mision':      {'required': False, 'allow_blank': True, 'default': ''},
            'vision':      {'required': False, 'allow_blank': True, 'default': ''},
        }


class CentroApoyoPublicoSerializer(serializers.ModelSerializer):
    latitud = serializers.SerializerMethodField()
    longitud = serializers.SerializerMethodField()
    distanciaKm = serializers.SerializerMethodField()

    class Meta:
        model = PerfilPatrocinador
        fields = (
            'id', 'nombre', 'tipo', 'direccion', 'latitud', 'longitud',
            'telefono', 'horario', 'sitio_web', 'descripcion', 'estado',
            'motivo_rechazo', 'created_at',
            'banner', 'logo', 'mision', 'vision', 'formas_ayuda', 'redes_sociales',
            'distanciaKm',
        )

    def get_latitud(self, obj):
        return obj.ubicacion_geo.y if obj.ubicacion_geo else None

    def get_longitud(self, obj):
        return obj.ubicacion_geo.x if obj.ubicacion_geo else None

    def get_distanciaKm(self, obj):
        # Solo viene poblado cuando la queryset se anota con .annotate(distancia=...)
        # (ver centros.services.centros_cercanos); en el resto de vistas es None.
        distancia = getattr(obj, 'distancia', None)
        return round(distancia.km, 2) if distancia is not None else None


class UsuarioResumenSerializer(serializers.ModelSerializer):
    """Representacion publica minima de un usuario, para anidar en
    resenas y listas de seguidores sin exponer datos de cuenta."""
    class Meta:
        model = Usuario
        fields = ('id', 'first_name', 'last_name', 'foto_perfil')


class PublicacionCentroSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicacionCentro
        fields = ('id', 'centro', 'contenido', 'imagen', 'created_at', 'updated_at')
        read_only_fields = ('id', 'centro', 'created_at', 'updated_at')


class ResenaCentroSerializer(serializers.ModelSerializer):
    """Representacion de lectura de una resena, con el usuario anidado."""
    usuario = UsuarioResumenSerializer(read_only=True)

    class Meta:
        model = ResenaCentro
        fields = ('id', 'centro', 'usuario', 'calificacion', 'comentario', 'respuesta', 'respuesta_fecha', 'created_at')
        read_only_fields = fields


class ResenaCentroCrearSerializer(serializers.ModelSerializer):
    """Payload de entrada para POST .../resenas/ — separado del de lectura
    porque ahi no hay 'usuario' que mandar (sale de request.user)."""
    class Meta:
        model = ResenaCentro
        fields = ('calificacion', 'comentario')
        extra_kwargs = {
            'comentario': {'required': False, 'allow_blank': True, 'default': ''},
        }


class ResponderResenaSerializer(serializers.Serializer):
    respuesta = serializers.CharField(allow_blank=False)


class SeguidorCentroSerializer(serializers.ModelSerializer):
    usuario = UsuarioResumenSerializer(read_only=True)

    class Meta:
        model = SeguidorCentro
        fields = ('id', 'usuario', 'created_at')
        read_only_fields = fields