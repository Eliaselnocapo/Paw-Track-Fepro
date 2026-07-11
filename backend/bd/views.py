from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.generics import RetrieveUpdateAPIView

from core.permissions import IsAuthorOrRescatistaAsignado, IsSelf
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.exceptions import PermissionDenied, AuthenticationFailed, ValidationError, NotFound
from django.contrib.auth import authenticate
from django.utils import timezone
import os

from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from allauth.socialaccount.providers.oauth2.client import OAuth2Client
from dj_rest_auth.registration.views import SocialLoginView

from notificaciones.services import notify_user

from .models import Usuario, Animal, Incidencia
from .serializers import UsuarioSerializer, AnimalSerializer, IncidenciaSerializer, EditarPerfilSerializer

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


class MiPerfilView(RetrieveUpdateAPIView):
    """GET/PATCH /api/auth/user/ — perfil propio (self-service).

    Registrada explícitamente ANTES de include('dj_rest_auth.urls') en
    pawtrack/urls.py para tomar precedencia sobre la vista por defecto de
    dj_rest_auth, que usaba UsuarioSerializer también para escritura y por
    lo tanto permitía cambiar email/roles y corrompía la contraseña (la
    guardaba sin hashear vía el update() genérico de ModelSerializer).
    """
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ['get', 'put', 'patch']

    def get_object(self):
        return self.request.user

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return EditarPerfilSerializer
        return UsuarioSerializer

    def update(self, request, *args, **kwargs):
        super().update(request, *args, **kwargs)
        # El front pide el usuario completo tras editar, no solo los campos que cambiaron
        return Response(UsuarioSerializer(request.user).data)


class UsuarioViewSet(viewsets.ModelViewSet):
    queryset = Usuario.objects.all().order_by('id')
    serializer_class = UsuarioSerializer

    def get_permissions(self):
        if self.action == 'create':
            permission_classes = [AllowAny]
        elif self.action in ('update', 'partial_update', 'destroy'):
            # Antes cualquier usuario autenticado podía editar o borrar la
            # cuenta de CUALQUIER otro usuario vía este ViewSet genérico
            # (solo se validaba autenticación, nunca dueño) — incluía poder
            # cambiar email/roles/password ajenos. IsSelf lo cierra.
            permission_classes = [IsAuthenticated, IsSelf]
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

    @action(detail=False, methods=['post'], url_path=r'(?P<folio>[^/.]+)/cancelar', permission_classes=[IsAuthenticated])
    def cancelar(self, request, folio=None):
        """El reportante cancela su propio reporte ("falsa alarma / ya se
        resolvió"). Estado terminal CANCELADO, distinto de CERRADO (que
        significa rescatado con éxito). Si había un rescate activo, también
        se cancela y se notifica al voluntario."""
        try:
            incidencia = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            raise NotFound("Reporte no encontrado.")

        if incidencia.usuario_reporta_id != request.user.id:
            raise PermissionDenied("Solo quien creó el reporte puede cancelarlo.")
        if incidencia.estado == 'CERRADO':
            raise ValidationError("No se puede cancelar un reporte ya cerrado.")
        if incidencia.estado == 'CANCELADO':
            raise ValidationError("Este reporte ya está cancelado.")

        motivo = request.data.get('motivo', '')

        from rescates.models import Rescate  # import local: evita import circular a nivel de módulo
        try:
            rescate = incidencia.rescate_activo
        except Rescate.DoesNotExist:
            rescate = None

        if rescate is not None and rescate.estado not in ('COMPLETADO', 'CANCELADO'):
            rescate.historial.append({
                "estado": "CANCELADO",
                "timestamp": timezone.now().isoformat(),
                "motivo": f"Reporte cancelado por el reportante. {motivo}".strip(),
            })
            rescate.estado = 'CANCELADO'
            rescate.fecha_cierre = timezone.now()
            rescate.save()
            notify_user(rescate.rescatista_id, {
                "type": "reporte_cancelado",
                "tipo": "reporte_cancelado",
                "folio": incidencia.folio,
                "mensaje": "El reportante canceló este caso.",
            })

        incidencia.estado = 'CANCELADO'
        incidencia.save(update_fields=['estado'])

        return Response({
            "code": "incidencia_cancelada",
            "detail": "Reporte cancelado.",
            "field_errors": {}
        }, status=status.HTTP_200_OK)

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
