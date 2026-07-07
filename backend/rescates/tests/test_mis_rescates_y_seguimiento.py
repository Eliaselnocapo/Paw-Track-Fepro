from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point

from bd.models import Usuario, Incidencia, Animal, PerfilRescatista
from rescates.models import Rescate


class MisRescatesYSeguimientoTests(APITestCase):
    """Cubre los pendientes que bloqueaban las pantallas del voluntario:
    get_or_create de PerfilRescatista, GET /mis-rescates/, GET /{id}/ y el
    paso intermedio EN_SITIO en PATCH /{id}/estado/."""

    def setUp(self):
        self.user_rescatista = Usuario.objects.create_user(
            email='rescatista@test.com',
            password='password123',
            roles=['RESCATISTA']
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.user_rescatista)

        self.user_rescatista2 = Usuario.objects.create_user(
            email='rescatista2@test.com',
            password='password123',
            roles=['RESCATISTA']
        )
        self.perfil_rescatista2 = PerfilRescatista.objects.create(usuario=self.user_rescatista2)

        self.user_normal = Usuario.objects.create_user(
            email='normal@test.com',
            password='password123',
            roles=['REPORTERO']
        )

        self.animal = Animal.objects.create(
            nombre="Max",
            tipo="PERRO",
            salud="HERIDO"
        )

        self.punto_centro = Point(-98.2062, 19.0414, srid=4326)

        self.incidencia = Incidencia.objects.create(
            tipo_incidencia="RESCATE_URGENTE",
            estado="PENDIENTE",
            usuario_reporta=self.user_normal,
            animal=self.animal,
            ubicacion=self.punto_centro
        )

    def test_aceptar_crea_perfil_rescatista_si_no_existe(self):
        """Usuario con rol RESCATISTA pero sin fila PerfilRescatista no debe tronar con 500."""
        user_sin_perfil = Usuario.objects.create_user(
            email='sinperfil@test.com',
            password='password123',
            roles=['RESCATISTA']
        )
        self.assertFalse(PerfilRescatista.objects.filter(usuario=user_sin_perfil).exists())

        self.client.force_authenticate(user=user_sin_perfil)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})

        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PerfilRescatista.objects.filter(usuario=user_sin_perfil).exists())

    def test_mis_rescates_devuelve_solo_los_del_usuario(self):
        """GET /rescates/mis-rescates/ solo lista los Rescate del rescatista autenticado."""
        rescate_propio = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )
        otra_incidencia = Incidencia.objects.create(
            tipo_incidencia="RESCATE_URGENTE",
            estado="ATENDIENDOSE",
            usuario_reporta=self.user_normal,
            animal=self.animal,
            ubicacion=self.punto_centro
        )
        Rescate.objects.create(
            incidencia=otra_incidencia,
            rescatista=self.user_rescatista2,
            estado='EN_CAMINO'
        )

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('mis-rescates')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        resultados = response.data['results']
        self.assertEqual(len(resultados), 1)
        self.assertEqual(resultados[0]['rescate_id'], rescate_propio.id)
        self.assertEqual(resultados[0]['incidencia']['folio'], self.incidencia.folio)

    def test_detalle_rescate_incluye_historial(self):
        """GET /rescates/{id}/ devuelve estado, historial e incidencia asociada."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO',
            historial=[{"estado": "EN_CAMINO", "timestamp": "2026-07-01T00:00:00"}]
        )

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('rescate-detalle', kwargs={'rescate_id': rescate.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['rescate_id'], rescate.id)
        self.assertEqual(len(response.data['historial']), 1)

    def test_detalle_rescate_ajeno_devuelve_403(self):
        """Un rescatista no puede ver el detalle del rescate de otro."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )

        self.client.force_authenticate(user=self.user_rescatista2)
        url = reverse('rescate-detalle', kwargs={'rescate_id': rescate.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_actualizar_estado_acepta_en_sitio_con_nota(self):
        """PATCH /rescates/{id}/estado/ acepta el paso intermedio EN_SITIO y guarda la nota."""
        rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_CAMINO'
        )

        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('actualizar-estado-rescate', kwargs={'rescate_id': rescate.id})
        response = self.client.patch(url, {'estado': 'EN_SITIO', 'nota': 'Llegué al punto, animal estable'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rescate.refresh_from_db()
        self.assertEqual(rescate.estado, 'EN_SITIO')
        self.assertEqual(rescate.historial[-1]['estado'], 'EN_SITIO')
        self.assertEqual(rescate.historial[-1]['nota'], 'Llegué al punto, animal estable')

    def test_seguimiento_historial_publico_devuelve_bitacora_por_folio(self):
        """GET /api/incidencias/seguimiento/{folio}/historial/ es público y
        expone la bitácora del rescate para el reportante."""
        Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.user_rescatista,
            estado='EN_SITIO',
            historial=[
                {"estado": "EN_CAMINO", "timestamp": "2026-07-01T00:00:00"},
                {"estado": "EN_SITIO", "timestamp": "2026-07-01T01:00:00", "nota": "Llegué"},
            ]
        )

        url = reverse('incidencia-seguimiento-historial', kwargs={'folio': self.incidencia.folio})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['folio'], self.incidencia.folio)
        self.assertEqual(len(response.data['historial']), 2)
        self.assertEqual(response.data['historial'][-1]['nota'], 'Llegué')

    def test_seguimiento_historial_sin_rescate_devuelve_lista_vacia(self):
        """Si aún no hay Rescate asociado (caso PENDIENTE), historial es []."""
        url = reverse('incidencia-seguimiento-historial', kwargs={'folio': self.incidencia.folio})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['historial'], [])

    def test_seguimiento_historial_folio_inexistente_devuelve_404(self):
        url = reverse('incidencia-seguimiento-historial', kwargs={'folio': 'NO-EXISTE-00000'})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
