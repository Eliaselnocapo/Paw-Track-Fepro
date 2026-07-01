import time
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point

from bd.models import Usuario, Animal, Incidencia, PerfilRescatista


class NuevosCamposFrontTests(APITestCase):
    """Verifica los tres campos nuevos expuestos al frontend: updated_at, direccion, rescatista_info."""

    def setUp(self):
        self.user_reportero = Usuario.objects.create_user(
            email='reportero@test.com',
            password='pass123',
            roles=['REPORTERO'],
            first_name='Ana',
            last_name='López',
        )
        self.user_rescatista = Usuario.objects.create_user(
            email='rescatista@test.com',
            password='pass123',
            roles=['RESCATISTA'],
            first_name='Carlos',
            last_name='Ruiz',
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.user_rescatista)

        self.animal = Animal.objects.create(nombre='Firulais', tipo='PERRO', salud='HERIDO')
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.user_reportero,
            animal=self.animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            estado='PENDIENTE',
            direccion='Av. Reforma 222, Col. Juárez',
        )
        self.url_detail = reverse('incidencia-detail', kwargs={'pk': self.incidencia.pk})

    # --- updated_at ---

    def test_updated_at_presente_en_respuesta(self):
        """GET de una incidencia incluye el campo updated_at."""
        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('updated_at', response.data)
        self.assertIsNotNone(response.data['updated_at'])

    def test_updated_at_cambia_al_editar(self):
        """updated_at se actualiza cuando se modifica el caso."""
        ts_antes = self.incidencia.updated_at

        # Esperar un tick para garantizar diferencia de timestamp
        time.sleep(0.05)

        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.save()
        self.incidencia.refresh_from_db()

        self.assertGreater(self.incidencia.updated_at, ts_antes)

    def test_updated_at_es_solo_lectura(self):
        """No se puede sobreescribir updated_at desde el API."""
        self.client.force_authenticate(user=self.user_reportero)
        payload = {'updated_at': '2000-01-01T00:00:00Z', 'latitud': 19.4326, 'longitud': -99.1332}
        response = self.client.patch(self.url_detail, payload, format='json')

        self.incidencia.refresh_from_db()
        # El campo en BD no debe ser el valor enviado
        self.assertNotEqual(str(self.incidencia.updated_at), '2000-01-01 00:00:00+00:00')

    # --- direccion ---

    def test_direccion_se_guarda_al_crear(self):
        """El campo direccion se persiste cuando se crea una incidencia."""
        self.client.force_authenticate(user=self.user_reportero)
        url_list = reverse('incidencia-list')
        payload = {
            'latitud': 19.43,
            'longitud': -99.13,
            'direccion': 'Calle Madero 45, Col. Centro',
            'tipo_incidencia': 'EMERGENCIA',
        }
        response = self.client.post(url_list, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['direccion'], 'Calle Madero 45, Col. Centro')

    def test_direccion_se_devuelve_en_get(self):
        """GET de una incidencia existente devuelve la dirección guardada."""
        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['direccion'], 'Av. Reforma 222, Col. Juárez')

    def test_direccion_se_actualiza_con_patch(self):
        """La dirección se puede corregir con PATCH."""
        self.client.force_authenticate(user=self.user_reportero)
        nueva_dir = 'Insurgentes Sur 1234, Col. Del Valle'
        response = self.client.patch(
            self.url_detail,
            {'direccion': nueva_dir},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.direccion, nueva_dir)

    def test_direccion_vacia_por_defecto(self):
        """Una incidencia creada sin direccion devuelve cadena vacía, no null."""
        self.client.force_authenticate(user=self.user_reportero)
        url_list = reverse('incidencia-list')
        payload = {
            'latitud': 19.43,
            'longitud': -99.13,
            'tipo_incidencia': 'EMERGENCIA',
        }
        response = self.client.post(url_list, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['direccion'], '')

    # --- rescatista_info ---

    def test_rescatista_info_es_null_sin_rescatista(self):
        """rescatista_info es null cuando nadie ha tomado el caso."""
        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data['rescatista_info'])

    def test_rescatista_info_devuelve_datos_al_asignar(self):
        """rescatista_info devuelve id, nombre y email cuando hay rescatista asignado."""
        self.incidencia.rescatista_asignado = self.perfil_rescatista
        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.save()

        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        info = response.data['rescatista_info']
        self.assertIsNotNone(info)
        self.assertEqual(info['id'], self.user_rescatista.id)
        self.assertEqual(info['nombre'], 'Carlos Ruiz')
        self.assertEqual(info['email'], 'rescatista@test.com')

    def test_rescatista_info_nombre_fallback_a_email(self):
        """Si el rescatista no tiene nombre, rescatista_info.nombre usa el email."""
        usuario_sin_nombre = Usuario.objects.create_user(
            email='sin-nombre@test.com',
            password='pass123',
            roles=['RESCATISTA'],
        )
        perfil = PerfilRescatista.objects.create(usuario=usuario_sin_nombre)
        self.incidencia.rescatista_asignado = perfil
        self.incidencia.save()

        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.data['rescatista_info']['nombre'], 'sin-nombre@test.com')
