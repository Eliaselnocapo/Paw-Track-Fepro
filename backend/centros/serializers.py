import json

from rest_framework import serializers

from bd.models import PerfilPatrocinador


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

    class Meta:
        model = PerfilPatrocinador
        fields = (
            'id', 'nombre', 'tipo', 'direccion', 'latitud', 'longitud',
            'telefono', 'horario', 'sitio_web', 'descripcion', 'estado',
            'motivo_rechazo', 'created_at',
            'banner', 'logo', 'mision', 'vision', 'formas_ayuda', 'redes_sociales',
        )

    def get_latitud(self, obj):
        return obj.ubicacion_geo.y if obj.ubicacion_geo else None

    def get_longitud(self, obj):
        return obj.ubicacion_geo.x if obj.ubicacion_geo else None
