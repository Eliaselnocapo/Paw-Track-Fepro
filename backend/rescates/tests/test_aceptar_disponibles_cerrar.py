from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile

from bd.models import Usuario, Incidencia, Animal, PerfilRescatista
from rescates.models import Rescate

class RescatesEndpointsTests(APITestCase):
    def setUp(self):
        # Crear usuario Rescatista 1
        self.user_rescatista = Usuario.objects.create_user(
            email='rescatista@test.com',
            password='password123',
            roles=['RESCATISTA']
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.user_rescatista)

        # Crear usuario Rescatista 2 (necesario para la prueba de choque)
        self.user_rescatista2 = Usuario.objects.create_user(
            email='rescatista2@test.com',
            password='password123',
            roles=['RESCATISTA']
        )
        self.perfil_rescatista2 = PerfilRescatista.objects.create(usuario=self.user_rescatista2)
        
        # Crear usuario normal (Reportero)
        self.user_normal = Usuario.objects.create_user(
            email='normal@test.com',
            password='password123',
            roles=['REPORTERO']
        )
        
        # Crear Animal Base para la incidencia
        self.animal = Animal.objects.create(
            nombre="Max",
            tipo="PERRO",
            salud="HERIDO"
        )
        
        # Usamos Point de PostGIS para poder calcular distancias en los nuevos tests
        self.punto_centro = Point(-98.2062, 19.0414, srid=4326)

        self.incidencia = Incidencia.objects.create(
             tipo_incidencia="RESCATE_URGENTE",
             estado="PENDIENTE",
             usuario_reporta=self.user_normal,
             animal=self.animal,
             ubicacion=self.punto_centro 
        )

    # --- TESTS AJUSTADOS AL CONTRATO B1 ---

    def test_rescatista_puede_aceptar_incidencia(self):
        """Un usuario con rol RESCATISTA debe poder aceptar la incidencia y recibir formato B1."""
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['code'], 'rescate_aceptado')
        
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.estado, 'ATENDIENDOSE')
        self.assertEqual(self.incidencia.rescatista_asignado, self.perfil_rescatista)

    def test_usuario_normal_no_puede_aceptar(self):
        """Un usuario sin el rol RESCATISTA debe recibir un 403 Forbidden estructurado."""
        self.client.force_authenticate(user=self.user_normal)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'permission_denied')
        
    def test_no_se_puede_aceptar_incidencia_no_pendiente(self):
        """Si la incidencia ya está ATENDIENDOSE, debe devolver 400 estructurado."""
        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.save()
        
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'invalid') # Handler global transforma ValidationError a 'invalid'

    # --- NUEVOS TESTS B2 ---

    def test_dos_rescatistas_mismo_caso_devuelve_409(self):
        """Test B2: Condición de carrera en OneToOneField. El segundo recibe 409."""
        # 1. Simulamos el milisegundo exacto de la condición de carrera:
        # Creamos el registro directamente en la BD saltándonos la vista,
        # y dejamos la incidencia como 'PENDIENTE' para engañar la primera validación.
        Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )

        # 2. El Rescatista 2 llega a la vista. Como la incidencia dice 'PENDIENTE',
        # pasa el IF de estado. Pero al intentar hacer el Rescate.objects.create(),
        # PostgreSQL detecta que ya hay un OneToOneField ocupado y lanza el IntegrityError.
        self.client.force_authenticate(user=self.user_rescatista2)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data['code'], 'case_already_taken')

    def test_disponibles_devuelve_solo_pendientes_en_radio(self):
        """Test B2: PostGIS filtra por 10km correctamente."""
        # Creamos una incidencia lejana para comprobar que no sale
        punto_lejano = Point(-99.1332, 19.4326, srid=4326) 
        Incidencia.objects.create(
            tipo_incidencia="RESCATE_URGENTE",
            estado="PENDIENTE",
            usuario_reporta=self.user_normal,
            animal=self.animal,
            ubicacion=punto_lejano
        )

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('rescates-disponibles')
        
        # Consultamos parados exactamente donde está la primera incidencia
        response = self.client.get(f"{url}?lat=19.0414&lng=-98.2062")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resultados = response.data['results']
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]['folio'], self.incidencia.folio)

    def test_cerrar_con_gps_lejano_devuelve_403(self):
        """Test B2: Validación estricta de 100 metros bloquea intentos fraudulentos."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )
        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.rescatista_asignado = self.perfil_rescatista
        self.incidencia.save()

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id})
        
        # Mandamos un cierre desde coordenadas lejanas
        foto_falsa = SimpleUploadedFile("foto.jpg", b"file_content", content_type="image/jpeg")
        data = {
            'lat': '19.4326', 
            'lng': '-99.1332',
            'foto': foto_falsa
        }
        
        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'gps_too_far')
