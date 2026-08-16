import io

from PIL import Image
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile

from bd.models import Usuario, Incidencia, Animal, PerfilRescatista
from rescates.models import Rescate


def imagen_valida(nombre='foto.jpg'):
    """JPEG real. validar_imagen() revisa los magic bytes del archivo, no la
    extensión ni el content_type, así que un placeholder de texto se rechaza."""
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), 'red').save(buffer, format='JPEG')
    buffer.seek(0)
    return SimpleUploadedFile(nombre, buffer.read(), content_type='image/jpeg')


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

    def test_incidencia_validada_se_puede_aceptar(self):
        """VALIDADO es un estado disponible igual que PENDIENTE: indica
        confianza en el reporte, no que ya esté tomado."""
        self.incidencia.estado = 'VALIDADO'
        self.incidencia.save()

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

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

    def test_cerrar_con_gps_lejano_no_bloquea(self):
        """El GPS de cierre es evidencia (a dónde se llevó al animal), no un
        candado por distancia: el voluntario traslada al animal a una clínica
        o refugio, así que exigir cercanía al punto del reporte rechazaría
        cierres legítimos."""
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

        data = {
            'lat': '19.4326',
            'lng': '-99.1332',
            'foto': imagen_valida(),
        }

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rescate.refresh_from_db()
        self.assertEqual(rescate.historial[-1]['ubicacion_cierre'], {'lat': 19.4326, 'lng': -99.1332})

    def test_cerrar_sin_foto_devuelve_400(self):
        """La foto de evidencia es obligatoria: sin ella el cierre verificado
        no significa nada."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id})

        response = self.client.post(
            url, {'lat': '19.0414', 'lng': '-98.2062'}, format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cerrar_con_archivo_que_no_es_imagen_devuelve_400(self):
        """Un archivo cualquiera renombrado a .jpg no debe pasar: la validación
        mira los magic bytes, no la extensión."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id})

        archivo_falso = SimpleUploadedFile(
            'foto.jpg', b'MZ\x90\x00 esto es un ejecutable', content_type='image/jpeg',
        )
        data = {'lat': '19.0414', 'lng': '-98.2062', 'foto': archivo_falso}

        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cierre_no_pisa_la_imagen_del_reporte(self):
        """Regresión: la foto de cierre iba sobre incidencia.imagen, borrando
        la foto original del reportante y dejando el índice de deduplicación
        apuntando a un archivo inexistente."""
        self.incidencia.imagen = imagen_valida('original.jpg')
        self.incidencia.save(update_fields=['imagen'])
        nombre_original = self.incidencia.imagen.name

        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('cerrar-rescate', kwargs={'rescate_id': rescate.id})

        data = {'lat': '19.0414', 'lng': '-98.2062', 'foto': imagen_valida('cierre.jpg')}
        response = self.client.post(url, data, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.incidencia.refresh_from_db()
        rescate.refresh_from_db()

        self.assertEqual(self.incidencia.imagen.name, nombre_original)
        self.assertTrue(rescate.closure_photo)
        self.assertIsNotNone(rescate.closure_location)