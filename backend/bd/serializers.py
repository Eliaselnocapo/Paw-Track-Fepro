from rest_framework import serializers
from django.contrib.gis.geos import Point
from .models import Usuario, PerfilRescatista, PerfilPatrocinador, Animal, Incidencia

class PerfilRescatistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilRescatista
        fields = ('misiones_completadas', 'horas_campo', 'habilidades', 'esta_certificado')

class PerfilPatrocinadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilPatrocinador
        fields = ('ubicacion', 'capacidad', 'horario', 'redes', 'nivel', 'total_donado', 'casos_soportados')

class UsuarioSerializer(serializers.ModelSerializer):
    perfil_rescatista = PerfilRescatistaSerializer(read_only=True)
    perfil_patrocinador = PerfilPatrocinadorSerializer(read_only=True)

    class Meta:
        model = Usuario
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'rol_principal', 'telefono', 'foto_perfil', 'perfil_rescatista', 'perfil_patrocinador')
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        usuario = super().create(validated_data)
        if password:
            usuario.set_password(password)
            usuario.save()
        if usuario.rol_principal == 'RESCATISTA':
            PerfilRescatista.objects.create(usuario=usuario)
        elif usuario.rol_principal == 'PATROCINADOR':
            PerfilPatrocinador.objects.create(usuario=usuario)
        return usuario

class AnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = ('id', 'nombre', 'color', 'tamano', 'tipo', 'raza', 'agresividad', 'salud', 'otros')
        extra_kwargs = {
            'nombre':      {'required': False, 'allow_blank': True, 'default': 'Sin nombre'},
            'color':       {'required': False, 'allow_blank': True, 'default': ''},
            'tamano':      {'required': False, 'allow_blank': True, 'default': ''},  # ← fix
            'tipo':        {'required': False, 'allow_blank': True, 'default': ''},
            'raza':        {'required': False, 'allow_blank': True, 'default': ''},
            'agresividad': {'required': False, 'allow_blank': True, 'default': ''},
            'salud':       {'required': False, 'allow_blank': True, 'default': ''},
            'otros':       {'required': False, 'allow_blank': True, 'default': ''},
        }

class IncidenciaSerializer(serializers.ModelSerializer):
    latitud  = serializers.FloatField(write_only=True)
    longitud = serializers.FloatField(write_only=True)
    lat_out  = serializers.SerializerMethodField(read_only=True)
    lng_out  = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Incidencia
        fields = (
            'id',
            'usuario_reporta', 'animal',
            'patrocinador', 'rescatista_asignado',
            'imagen',
            'latitud', 'longitud',
            'lat_out', 'lng_out',
            'caracteristicas', 'estado', 'tipo_incidencia', 'recompensa',
        )
        extra_kwargs = {
            'usuario_reporta':     {'required': False, 'allow_null': True},
            'animal':              {'required': False, 'allow_null': True},
            'patrocinador':        {'required': False, 'allow_null': True},
            'rescatista_asignado': {'required': False, 'allow_null': True},
            'recompensa':          {'required': False, 'allow_null': True},
            'imagen':              {'required': False},
            'estado':              {'required': False, 'default': 'PENDIENTE'},
            'tipo_incidencia':     {'required': False, 'default': 'EMERGENCIA'},
            'caracteristicas':     {'required': False, 'allow_blank': True, 'default': ''},
        }

    def get_lat_out(self, obj):
        return obj.ubicacion.y if obj.ubicacion else None

    def get_lng_out(self, obj):
        return obj.ubicacion.x if obj.ubicacion else None

    def create(self, validated_data):
        lat = validated_data.pop('latitud')
        lng = validated_data.pop('longitud')
        validated_data['ubicacion'] = Point(lng, lat, srid=4326)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        lat = validated_data.pop('latitud', None)
        lng = validated_data.pop('longitud', None)
        if lat is not None and lng is not None:
            validated_data['ubicacion'] = Point(lng, lat, srid=4326)
        return super().update(instance, validated_data)