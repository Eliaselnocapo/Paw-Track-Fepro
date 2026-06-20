from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
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
            return Response(
                {'detail': 'Se requieren email y contraseña.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {'non_field_errors': ['Credenciales incorrectas.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.is_active:
            return Response(
                {'non_field_errors': ['Esta cuenta está desactivada.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(_jwt_response(user), status=status.HTTP_200_OK)


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
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
            return Response({'code': 'not_owner', 'detail': 'No puedes modificar roles de otro usuario.', 'field_errors': {}}, status=403)
                
        nuevos = request.data.get('roles', [])
            
        if 'PATROCINADOR' in nuevos and not request.user.is_staff:
            return Response({'code': 'role_requires_approval', 'detail': 'El rol PATROCINADOR requiere verificación.', 'field_errors': {}}, status=403)
                
        roles_actuales = usuario.roles or []
        for rol in nuevos:
            if rol not in ['REPORTERO', 'RESCATISTA', 'PATROCINADOR']:
                return Response({'code': 'validation_error', 'detail': f'Rol inválido: {rol}', 'field_errors': {}}, status=400)
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
        if self.action in ('destroy', 'mis_casos'):
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
            if animal_serializer.is_valid():
                animal = animal_serializer.save()
                data['animal'] = animal.id
            else:
                return Response(
                    {'animal_error': animal_serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if imagen:
            data['imagen'] = imagen

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if not request.user.is_staff and instance.usuario_reporta_id != request.user.id:
            return Response(
                {'detail': 'No tienes permiso para editar este reporte.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Campos que van al Animal asociado (no a la Incidencia)
        edad_estimada = request.data.get('edad_estimada')
        peso_estimado = request.data.get('peso_estimado')

        response = super().update(request, *args, **kwargs)

        if instance.animal and (edad_estimada is not None or peso_estimado is not None):
            animal = instance.animal
            campos_animal = []
            if edad_estimada is not None:
                animal.edad_estimada = edad_estimada
                campos_animal.append('edad_estimada')
            if peso_estimado is not None:
                animal.peso_estimado = peso_estimado
                campos_animal.append('peso_estimado')
            animal.save(update_fields=campos_animal)
        return response

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
            return Response({'detail': 'Reporte no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path=r'seguimiento/(?P<folio>[^/.]+)', permission_classes=[AllowAny])
    def seguimiento(self, request, folio=None):
        try:
            inc = Incidencia.objects.select_related('animal', 'rescatista_asignado').get(folio=folio)
        except Incidencia.DoesNotExist:
            return Response({'code': 'not_found', 'detail': 'Reporte no encontrado.', 'field_errors': {}}, status=404)
                
        return Response({
                'folio': inc.folio,
                'estado': inc.estado,
                'tipo_incidencia': inc.tipo_incidencia,
                'urgency_score': inc.urgency_score,
                'created_at': inc.created_at,
                'rescatista_asignado': inc.rescatista_asignado is not None,
                'tipo_animal': inc.animal.tipo if inc.animal else None,
                })    
