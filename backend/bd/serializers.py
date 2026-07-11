from rest_framework import serializers
from django.contrib.gis.geos import Point
from dj_rest_auth.registration.serializers import RegisterSerializer
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
        fields = ('id', 'email', 'first_name', 'last_name', 'password', 'roles', 'telefono', 'foto_perfil', 'perfil_rescatista', 'perfil_patrocinador')
        extra_kwargs = {'password': {'write_only': True}}

    def validate_roles(self, value):
        validos = set(Usuario.ROLES_VALIDOS)
        invalidos = [r for r in value if r not in validos]
        if invalidos:
            raise serializers.ValidationError(f"Roles inválidos: {invalidos}. Válidos: {Usuario.ROLES_VALIDOS}")
        if not value:
            raise serializers.ValidationError("El usuario debe tener al menos un rol.")
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        usuario = super().create(validated_data)
        if password:
            usuario.set_password(password)
            usuario.save()
        roles = usuario.roles or []
        if 'RESCATISTA' in roles:
            PerfilRescatista.objects.get_or_create(usuario=usuario)
        if 'PATROCINADOR' in roles:
            PerfilPatrocinador.objects.get_or_create(usuario=usuario)
        return usuario

class CustomRegisterSerializer(RegisterSerializer):
    """Extiende el registro de dj-rest-auth: agrega roles, first_name, last_name."""
    username   = None
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    last_name  = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    roles = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
    )

    def validate_email(self, value):
        if Usuario.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe una cuenta con este correo electrónico.")
        return value

    def validate_roles(self, value):
        validos = set(Usuario.ROLES_VALIDOS)
        invalidos = [r for r in value if r not in validos]
        if invalidos:
            raise serializers.ValidationError(
                f"Roles inválidos: {invalidos}. Válidos: {Usuario.ROLES_VALIDOS}"
            )
        roles = ['REPORTERO', 'RESCATISTA']
        if 'PATROCINADOR' in value:
            roles.append('PATROCINADOR')
        return roles

    def get_cleaned_data(self):
        data = super().get_cleaned_data()
        data['first_name'] = self.validated_data.get('first_name', '')
        data['last_name']  = self.validated_data.get('last_name', '')
        data['roles']      = self.validated_data.get('roles', ['REPORTERO', 'RESCATISTA'])
        return data

    def save(self, request):
        user = super().save(request)
        cleaned = self.get_cleaned_data()
        user.first_name = cleaned.get('first_name', '')
        user.last_name  = cleaned.get('last_name', '')
        user.roles      = cleaned.get('roles', ['REPORTERO', 'RESCATISTA'])
        user.save(update_fields=['first_name', 'last_name', 'roles'])

        roles = user.roles or []
        if 'RESCATISTA' in roles:
            PerfilRescatista.objects.get_or_create(usuario=user)
        if 'PATROCINADOR' in roles:
            PerfilPatrocinador.objects.get_or_create(usuario=user)

        return user


class AnimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = Animal
        fields = ('id', 'nombre', 'color', 'tamano', 'tipo', 'raza', 'agresividad', 'salud', 'otros', 'edad_estimada', 'peso_estimado')
        extra_kwargs = {
            'nombre':        {'required': False, 'allow_blank': True, 'default': 'Sin nombre'},
            'color':         {'required': False, 'allow_blank': True, 'default': ''},
            'tamano':        {'required': False, 'allow_blank': True, 'default': ''},
            'tipo':          {'required': False, 'allow_blank': True, 'default': ''},
            'raza':          {'required': False, 'allow_blank': True, 'default': ''},
            'agresividad':   {'required': False, 'allow_blank': True, 'default': ''},
            'salud':         {'required': False, 'allow_blank': True, 'default': ''},
            'otros':         {'required': False, 'allow_blank': True, 'default': ''},
            'edad_estimada': {'required': False, 'allow_blank': True, 'default': ''},
            'peso_estimado': {'required': False, 'allow_blank': True, 'default': ''},
        }

class IncidenciaSerializer(serializers.ModelSerializer):
    latitud  = serializers.FloatField(write_only=True)
    longitud = serializers.FloatField(write_only=True)
    lat_out  = serializers.SerializerMethodField(read_only=True)
    lng_out  = serializers.SerializerMethodField(read_only=True)
    coincidencias_visuales = serializers.SerializerMethodField()

    tipo_animal      = serializers.CharField(source='animal.tipo',           read_only=True, default='')
    tamano_animal    = serializers.CharField(source='animal.tamano',         read_only=True, default='')
    condicion_animal = serializers.CharField(source='animal.salud',          read_only=True, default='')
    notas_animal     = serializers.CharField(source='animal.otros',          read_only=True, default='')
    edad_estimada    = serializers.CharField(source='animal.edad_estimada',  read_only=True, default='')
    peso_estimado    = serializers.CharField(source='animal.peso_estimado',  read_only=True, default='')

    rescatista_info  = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Incidencia
        fields = (
            'id',
            'usuario_reporta', 'animal',
            'patrocinador', 'rescatista_asignado', 'rescatista_info',
            'imagen',
            'latitud', 'longitud',
            'lat_out', 'lng_out',
            'direccion',
            'tipo_animal', 'tamano_animal', 'condicion_animal', 'notas_animal', 'edad_estimada', 'peso_estimado',
            'nombre_caso', 'nombre_contacto', 'telefono_contacto',
            'caracteristicas', 'ficha_voluntario', 'estado', 'tipo_incidencia', 'recompensa',
            'urgency_score', 'trust_score', 'created_at', 'updated_at', 'folio',
            'coincidencias_visuales',
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
            'nombre_caso':         {'required': False, 'allow_blank': True, 'default': ''},
            'nombre_contacto':     {'required': False, 'allow_blank': True, 'default': ''},
            'telefono_contacto':   {'required': False, 'allow_blank': True, 'default': ''},
            'caracteristicas':     {'required': False, 'allow_blank': True, 'default': ''},
            'ficha_voluntario':    {'required': False, 'allow_blank': True, 'default': ''},
            'direccion':           {'required': False, 'allow_blank': True, 'default': ''},
            'urgency_score':       {'required': False},
            'trust_score':         {'read_only': True},
            'created_at':          {'read_only': True},
            'updated_at':          {'read_only': True},
            'folio':               {'read_only': True},
        }

    def get_lat_out(self, obj):
        return obj.ubicacion.y if obj.ubicacion else None

    def get_lng_out(self, obj):
        return obj.ubicacion.x if obj.ubicacion else None

    def get_rescatista_info(self, obj):
        if not obj.rescatista_asignado:
            return None
        u = obj.rescatista_asignado.usuario
        return {
            "id":     u.id,
            "nombre": f"{u.first_name} {u.last_name}".strip() or u.email,
            "email":  u.email,
        }
    
    def get_coincidencias_visuales(self, obj):
        # Fix P0-5: Retorna directamente la lista persistida desde la BD.
        # Cero llamadas a IA bloqueando la petición del cliente y total aislamiento de módulos.
        return obj.coincidencias_visuales_ids

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