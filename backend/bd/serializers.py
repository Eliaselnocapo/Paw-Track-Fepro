from rest_framework import serializers
from .models import Usuario, PerfilRescatista, PerfilPatrocinador

# Serializamos los perfiles para que viajen junto con el usuario
class PerfilRescatistaSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilRescatista
        fields = ('misiones_completadas', 'horas_campo', 'habilidades', 'esta_certificado')

class PerfilPatrocinadorSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerfilPatrocinador
        fields = ('ubicacion', 'capacidad', 'horario', 'redes', 'nivel', 'total_donado', 'casos_soportados')

# Serializador principal
class UsuarioSerializer(serializers.ModelSerializer):
    # Anidamos los perfiles (read_only porque los crearemos desde el backend)
    perfil_rescatista = PerfilRescatistaSerializer(read_only=True)
    perfil_patrocinador = PerfilPatrocinadorSerializer(read_only=True)
    
    class Meta:
        model = Usuario
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'password', 'rol_principal', 'telefono', 'foto_perfil', 'perfil_rescatista', 'perfil_patrocinador')
       
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        #  Sacamos la contraseña del diccionario y creamos al usuario
        password = validated_data.pop('password', None)
        usuario = super().create(validated_data)
        
        #  Encriptamos la contraseña con el algoritmo de Django (Argon2/PBKDF2)
        if password:
            usuario.set_password(password)
            usuario.save()
            
        #  Lógica de Negocio: Crear su perfil en blanco automáticamente según el rol
        if usuario.rol_principal == 'RESCATISTA':
            PerfilRescatista.objects.create(usuario=usuario)
        elif usuario.rol_principal == 'PATROCINADOR':
            PerfilPatrocinador.objects.create(usuario=usuario)
            
        return usuario
