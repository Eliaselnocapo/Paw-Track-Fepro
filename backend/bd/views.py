import re
import pdfplumber
from rest_framework.parsers import MultiPartParser, FormParser
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
from django.contrib.gis.geos import Point
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


class ProcesarCartelPDFView(APIView):
    permission_classes = [AllowAny]
    parser_classes = (MultiPartParser, FormParser)

    # Palabras que razonablemente aparecen en un cartel de mascota perdida/
    # encontrada. Si el texto no toca NINGUNA de estas, casi seguro es un
    # documento sin relación (horario de clases, factura, tarea, etc.).
    PALABRAS_CLAVE_CARTEL = [
        'mascota', 'perro', 'perrito', 'gato', 'gatito', 'animal',
        'perdido', 'perdida', 'extraviado', 'extraviada',
        'encontrado', 'encontrada', 'callejero', 'callejera',
        'rescate', 'recompensa', 'adopcion', 'adopción',
        'paw track', 'pawtrack',
    ]

    def post(self, request, *args, **kwargs):
        pdf_file = request.FILES.get('file')
        if not pdf_file:
            return Response({"error": "No hay archivo"}, status=status.HTTP_400_BAD_REQUEST)
        texto_extraido = ""
        try:
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        texto_extraido += text + "\n"
        except Exception:
            return Response({"error": "No se pudo leer el PDF."}, status=status.HTTP_400_BAD_REQUEST)
        if not texto_extraido.strip():
            return Response(
                {"error": "El PDF no tiene texto legible."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )
        texto_limpio = " ".join(texto_extraido.split())
        texto_lower = texto_limpio.lower()

        folio_match = re.search(r'\b[A-Z]{2,4}-[A-Z]{2,4}-\d{4,6}\b', texto_limpio)

        # Un cartel real de PawTrack SIEMPRE trae folio (lo imprime CartelPdf).
        # Si no hay folio, exigimos al menos una palabra clave relacionada a
        # mascotas para aceptar el documento — así rechazamos horarios,
        # tareas, facturas, o cualquier PDF que no tenga nada que ver.
        es_relevante = bool(folio_match) or any(
            palabra in texto_lower for palabra in self.PALABRAS_CLAVE_CARTEL
        )

        if not es_relevante:
            return Response(
                {"error": "Este PDF no parece ser un cartel de mascota. Sube el cartel que generó PawTrack u otro relacionado a un reporte."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )

        telefono_match = re.search(r'\b\d{10}\b', texto_limpio)

        return Response({
            "descripcion_bruta": texto_limpio,
            "telefono_contacto": telefono_match.group(0) if telefono_match else "",
            "folio_detectado": folio_match.group(0) if folio_match else None,
        }, status=status.HTTP_200_OK)


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
        nueva_incidencia = serializer.instance

        candidata_descartada = self._resolver_duplicado_en_creacion(request, data, nueva_incidencia)
        if candidata_descartada is not None:
            # Confirmado como duplicado: nueva_incidencia ya se borró (ver
            # descartar_duplicado) — no hay nada que serializar ni notificar.
            return Response({
                'duplicado_descartado': True,
                'folio_existente': candidata_descartada.folio,
            }, status=status.HTTP_200_OK)

        from notificaciones.services import broadcast_new_report
        broadcast_new_report(nueva_incidencia)

        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def _resolver_duplicado_en_creacion(self, request, data, nueva_incidencia):
        """Si el paso 4 del wizard ya le preguntó al reportante por un
        candidato a duplicado (ver verificar_duplicado más abajo) y este
        envía la decisión junto con el resto del formulario, aquí se aplica:
        si confirmó, se borra nueva_incidencia por completo (ver
        descartar_duplicado) — el candidato ya existe, no hace falta
        guardar nada del reporte nuevo, ni como caso cerrado. Si rechazó,
        solo se deja constancia en SugerenciaDuplicado y el reporte queda
        como caso independiente. La decisión ya la tomó el humano antes de
        llegar aquí — este método nunca decide solo. Devuelve la Incidencia
        candidata si se descartó (confirmado), o None si no (sin candidato,
        folio inválido, o rechazado).
        """
        folio_candidato = data.get('duplicado_candidato_folio')
        if not folio_candidato:
            return None

        candidata = Incidencia.objects.filter(folio=folio_candidato).exclude(id=nueva_incidencia.id).first()
        if not candidata:
            return None  # folio inválido/ya no existe: se ignora, el reporte queda como caso independiente

        confirmado = str(data.get('duplicado_confirmado', '')).strip().lower() in ('true', '1')

        if confirmado:
            from deduplicacion.services import descartar_duplicado
            descartar_duplicado(original=candidata, duplicado=nueva_incidencia)
            return candidata

        from deduplicacion.models import SugerenciaDuplicado
        try:
            score = float(data.get('duplicado_score', 0) or 0)
        except (TypeError, ValueError):
            score = 0.0

        SugerenciaDuplicado.objects.create(
            incidencia_nueva=nueva_incidencia,
            incidencia_candidata=candidata,
            score=score,
            estado='RECHAZADA',
            resuelto_at=timezone.now(),
            resuelto_por=request.user if request.user.is_authenticated else None,
        )
        return None

    @action(detail=False, methods=['post'], url_path='verificar-duplicado', permission_classes=[AllowAny])
    def verificar_duplicado(self, request):
        """
        Chequeo SÍNCRONO de posibles duplicados, pensado para correr en el
        paso 4 del wizard de reporte — ANTES de crear ninguna Incidencia.
        Reusa exactamente el mismo pipeline (filtros geo/estructura + visión
        + ranking ponderado) que antes corría async por Celery después de
        crear el reporte, pero aquí:
          - no persiste nada (ni Incidencia ni Animal),
          - no muta el índice HNSW (solo lectura, buscar_similares),
          - regresa el mejor candidato (si supera UMBRAL_REVISION) para que
            el front le pregunte al reportante "¿es este tu caso?" antes de
            que exista un registro nuevo.

        Si el reportante confirma, el folio del candidato viaja de vuelta en
        el POST de creación (`duplicado_candidato_folio` +
        `duplicado_confirmado`) — ver create()/_resolver_duplicado_en_creacion.
        """
        from deduplicacion.filtros import candidatos_por_metadatos
        from deduplicacion.ranking import RankingService
        from deduplicacion.services import VisionService

        imagen = request.FILES.get('imagen')
        tipo = (request.data.get('tipo_animal') or '').strip()
        lat = request.data.get('latitud')
        lng = request.data.get('longitud')

        if not imagen or not tipo or lat is None or lng is None:
            return Response({'candidato': None})

        try:
            lat, lng = float(lat), float(lng)
        except (TypeError, ValueError):
            raise ValidationError("latitud/longitud inválidas.")

        animal_temp = Animal(
            tipo=tipo,
            tamano=(request.data.get('tamano_animal') or '').strip(),
            color=(request.data.get('color_animal') or '').strip(),
            raza=(request.data.get('raza_animal') or '').strip(),
        )
        incidencia_temp = Incidencia(animal=animal_temp, ubicacion=Point(lng, lat, srid=4326), caracteristicas='')

        candidatos = [c for c in candidatos_por_metadatos(incidencia_temp) if c.imagen]
        if not candidatos:
            return Response({'candidato': None})

        vision_ai = VisionService()
        try:
            emb = vision_ai._get_embedding(imagen, tipo)
        except ValueError:
            return Response({'candidato': None})  # especie no soportada para IA visual

        candidatos_ids = [c.id for c in candidatos]
        similitud_visual = vision_ai.buscar_similares(emb, tipo, candidatos_ids)

        resultados = RankingService.calcular_score_final(candidatos, similitud_visual, incidencia_temp)
        if not resultados or resultados[0]['score'] < RankingService.UMBRAL_REVISION:
            return Response({'candidato': None})

        mejor = resultados[0]
        candidata = mejor['incidencia']
        return Response({
            'candidato': {
                'score': mejor['score'],
                'folio': candidata.folio,
                'tipo_animal': candidata.animal.tipo if candidata.animal else None,
                'imagen': request.build_absolute_uri(candidata.imagen.url) if candidata.imagen else None,
                'created_at': candidata.created_at,
            }
        })

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

    @action(detail=False, methods=['post'], url_path='reclamar', permission_classes=[IsAuthenticated])
    def reclamar(self, request):
        """
        Asocia a la cuenta del usuario logueado un reporte que se creó como
        invitado (usuario_reporta=None), a partir del folio detectado en el
        cartel PDF que subió (ProcesarCartelPDFView). No crea nada nuevo:
        solo reclama el reporte existente.
        """
        folio = (request.data.get('folio') or '').strip()
        if not folio:
            return Response(
                {"error": "Falta el folio."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            incidencia = Incidencia.objects.get(folio=folio)
        except Incidencia.DoesNotExist:
            return Response(
                {"error": f"No existe ningún reporte con el folio {folio}."},
                status=status.HTTP_404_NOT_FOUND
            )

        if incidencia.usuario_reporta_id is not None:
            if incidencia.usuario_reporta_id == request.user.id:
                # Ya es suyo, no hay nada que hacer — no es un error.
                serializer = self.get_serializer(incidencia)
                return Response(serializer.data, status=status.HTTP_200_OK)

            return Response(
                {"error": "Este reporte ya pertenece a otra cuenta."},
                status=status.HTTP_409_CONFLICT
            )

        incidencia.usuario_reporta = request.user
        incidencia.save(update_fields=['usuario_reporta'])

        serializer = self.get_serializer(incidencia)
        return Response(serializer.data, status=status.HTTP_200_OK)

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
