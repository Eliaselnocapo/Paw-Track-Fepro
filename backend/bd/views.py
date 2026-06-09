from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import Usuario
from .serializers import UsuarioSerializer
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response

from .models import Animal, Incidencia
from .serializers import AnimalSerializer, IncidenciaSerializer


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all()
    serializer_class = UsuarioSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [AllowAny]
        else:
            permission_classes = [IsAuthenticated]
        return [permission() for permission in permission_classes]


class GoogleLogin(SocialLoginView):
    adapter_class = GoogleOAuth2Adapter
    callback_url = "http://localhost:4200/"
    client_class = OAuth2Client


class AnimalViewSet(viewsets.ModelViewSet):
    queryset = Animal.objects.all()
    serializer_class = AnimalSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class IncidenciaViewSet(viewsets.ModelViewSet):
    queryset = Incidencia.objects.all().order_by('-id')
    serializer_class = IncidenciaSerializer
    permission_classes = [AllowAny]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def create(self, request, *args, **kwargs):
        # Convertir QueryDict a dict Python plano para poder mutarlo libremente
        data = {key: request.data[key] for key in request.data}

        # Manejar el archivo de imagen por separado (no está en request.data como string)
        imagen = request.FILES.get('imagen', None)

        # Si no viene animal_id, crear Animal on-the-fly con los datos del paso 2
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
                data['animal'] = animal.id  # ahora sí funciona — es un dict plano
            else:
                # Si el animal falla, devolver el error explícitamente
                return Response(
                    {'animal_error': animal_serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Re-agregar la imagen si existe
        if imagen:
            data['imagen'] = imagen

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)