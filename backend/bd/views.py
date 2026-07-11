from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser

from core.permissions import IsAuthorOrRescatistaAsignado
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import PermissionDenied, AuthenticationFailed, ValidationError, NotFound
from django.contrib.auth import authenticate
import os

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from .models import Usuario, Animal, Incidencia
from .serializers import UsuarioSerializer, AnimalSerializer, IncidenciaSerializer

def _jwt_response(user):
    """Genera el response estándar {access, refresh, user} con simplejwt."""
    refresh = RefreshToken.for_user(user)
    return {
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': UsuarioSerializer(user).data,
    }


class LoginView(APIView):
    """Login por email/contraseña — bypasses dj_rest_auth para control total del JWT."""
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')

        if not email or not password:
            raise ValidationError("Se requieren email y contraseña.")

        user = authenticate(request, email=email, password=password)
        if user is None:
            raise AuthenticationFailed("Credenciales incorrectas.")
        if not user.is_active:
                raise AuthenticationFailed("Esta cuenta está desactivada.")

        return Response(_jwt_response(user), status=status.HTTP_200_OK)


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by('id')
    serializer_class = UsuarioSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]

    @action(detail=True, methods=['patch'], url_path='roles', permission_classes=[IsAuthenticated])
    def add_roles(self, request, pk=None):
        usuario = self.get_object()
            
        if usuario.id != request.user.id:
             raise PermissionDenied("No puedes modificar roles de otro usuario.", code='not_owner')

        nuevos = request.data.get('roles', [])

        if 'PATROCINADOR' in nuevos and not request.user.is_staff:
                    raise PermissionDenied("El rol PATROCINADOR requiere verificación.", code='role_requires_approval')
                            
        roles_actuales = usuario.roles or []
        for rol in nuevos:
            if rol not in ['REPORTERO', 'RESCATISTA', 'PATROCINADOR']:
                raise ValidationError(f"Rol inválido: {rol}")
            if rol not in roles_actuales:
                roles_actuales.append(rol)
                    
        usuario.roles = roles_actuales
        usuario.save(update_fields=['roles'])
            
        if 'RESCATISTA' in nuevos:
            from .models import PerfilRescatista # Import local para evitar problemas si el modelo está abajo
            PerfilRescatista.objects.get_or_create(usuario=usuario)
                
        from .serializers import UsuarioSerializer
        return Response(UsuarioSerializer(usuario).data)
        


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = os.environ.get('GOOGLE_CALLBACK_URL', 'http://localhost:8100/')
    client_class = OAuth2Client


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all()
    serializer_class = AnimalSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class IncidenciaViewSet(viewsets.ModelViewSet):
    queryset = Incidencia.objects.all().order_by('-id')
    serializer_class = IncidenciaSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_permissions(self):
        if self.action == 'destroy':
            return [IsAdminUser()]
        if self.action in ('update', 'partial_update'):
            return [IsAuthenticated(), IsAuthorOrRescatistaAsignado()]
        if self.action == 'mis_casos':
            return [IsAuthenticated()]
        return [AllowAny()]

    def create(self, request, *args, **kwargs):
        data = {key: request.data[key] for key in request.data}
        imagen = request.FILES.get('imagen', None)

        # Asignar dueño del reporte si el usuario está autenticado
        if request.user.is_authenticated:
            data['usuario_reporta'] = request.user.id

        if not data.get('animal'):
            animal_data = {
                'nombre':      data.get('animal_nombre', 'Sin nombre'),
                'tipo':        data.get('tipo_animal', ''),
                'tamano':      data.get('tamano_animal', ''),
                'salud':       data.get('condicion_animal', ''),
                'color':       '',
                'raza':        '',
                'agresividad': '',
                'otros':       data.get('notas_animal', ''),
            }
            animal_serializer = AnimalSerializer(data=animal_data)
            animal_serializer.is_valid(raise_exception=True)
            animal = animal_serializer.save()
            data['animal'] = animal.id

        if imagen:
            data['imagen'] = imagen

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()

        # Campos que realmente pertenecen al Animal asociado
        tipo_animal = request.data.get('tipo_animal')
        tamano_animal = request.data.get('tamano_animal')
        condicion_animal = request.data.get('condicion_animal')
        notas_animal = request.data.get('notas_animal')
        edad_estimada = request.data.get('edad_estimada')
        peso_estimado = request.data.get('peso_estimado')

        campos_animal_recibidos = any([
            tipo_animal is not None,
            tamano_animal is not None,
            condicion_animal is not None,
            notas_animal is not None,
            edad_estimada is not None,
            peso_estimado is not None,
        ])

        if campos_animal_recibidos:
            if not instance.animal:
                animal = Animal.objects.create(
                    nombre='Sin nombre',
                    tipo='',
                    tamano='',
                    salud='',
                    otros='',
                )
                instance.animal = animal
                instance.save(update_fields=['animal'])
            else:
                animal = instance.animal

            campos_animal = []

            if tipo_animal is not None:
                animal.tipo = tipo_animal
                campos_animal.append('tipo')

            if tamano_animal is not None:
                animal.tamano = tamano_animal
                campos_animal.append('tamano')

            if condicion_animal is not None:
                animal.salud = condicion_animal
                campos_animal.append('salud')

            if notas_animal is not None:
                animal.otros = notas_animal
                campos_animal.append('otros')

            if edad_estimada is not None:
                animal.edad_estimada = edad_estimada
                campos_animal.append('edad_estimada')

            if peso_estimado is not None:
                animal.peso_estimado = peso_estimado
                campos_animal.append('peso_estimado')

            if campos_animal:
                animal.save(update_fields=campos_animal)

        # El reportante (autor) y el rescatista asignado comparten el permiso
        # de PATCH, pero cada uno solo puede escribir su propio campo de texto:
        # caracteristicas = seguimiento del reportante, ficha_voluntario = ficha
        # clínica del rescatista. Así ninguno pisa las notas del otro.
        data = {key: request.data[key] for key in request.data}
        es_autor = instance.usuario_reporta_id == request.user.id
        perfil = getattr(request.user, 'perfil_rescatista', None)
        es_rescatista_asignado = perfil is not None and instance.rescatista_asignado_id == perfil.id

        if not es_autor:
            data.pop('caracteristicas', None)
        if not es_rescatista_asignado:
            data.pop('ficha_voluntario', None)

        partial = kwargs.get('partial', False)
        serializer = self.get_serializer(instance, data=data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        instance.refresh_from_db()

        return Response(serializer.data, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        kwargs['partial'] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='mis-casos', permission_classes=[IsAuthenticated])
    def mis_casos(self, request):
        qs = Incidencia.objects.filter(usuario_reporta=request.user).order_by('-id')
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'folio/(?P<folio>[^/.]+)')
    def por_folio(self, request, folio=None):
        try:
            instance = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            raise NotFound("Reporte no encontrado.")
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'seguimiento/(?P<folio>[^/.]+)', permission_classes=[AllowAny])
    def seguimiento(self, request, folio=None):
        try:
            inc = Incidencia.objects.select_related('animal', 'rescatista_asignado').get(folio=folio)
        except Incidencia.DoesNotExist:
            raise NotFound("Reporte no encontrado.")
                
        return Response({
                'folio': inc.folio,
                'estado': inc.estado,
                'tipo_incidencia': inc.tipo_incidencia,
                'urgency_score': inc.urgency_score,
                'created_at': inc.created_at,
                'rescatista_asignado': inc.rescatista_asignado is not None,
                'tipo_animal': inc.animal.tipo if inc.animal else None,
                })    
