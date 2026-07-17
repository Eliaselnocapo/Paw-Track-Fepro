from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point

from bd.models import Usuario, Animal, Incidencia, PerfilRescatista
from rescates.models import Rescate


class CancelarIncidenciaTests(APITestCase):
    """POST /api/incidencias/{folio}/cancelar/ — el reportante cancela su
    propio reporte ("falsa alarma / ya se resolvió"). Estado terminal
    CANCELADO, distinto de CERRADO (rescatado con éxito)."""

    def setUp(self):
        self.reportante = Usuario.objects.create_user(
            email='reportante@test.com', password='pass123', roles=['REPORTERO']
        )
        self.otro_usuario = Usuario.objects.create_user(
            email='otro@test.com', password='pass123', roles=['REPORTERO']
        )
        self.rescatista = Usuario.objects.create_user(
            email='rescatista@test.com', password='pass123', roles=['RESCATISTA']
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.rescatista)
        self.animal = Animal.objects.create(nombre='Firulais', tipo='PERRO', salud='ESTABLE')
        self.punto = Point(-98.2062, 19.0414, srid=4326)
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.reportante, animal=self.animal,
            ubicacion=self.punto, estado='PENDIENTE',
        )

    def _url(self, folio):
        return reverse('incidencia-cancelar', kwargs={'folio': folio})

    def test_reportante_puede_cancelar_su_reporte(self):
        self.client.force_authenticate(user=self.reportante)
        response = self.client.post(self._url(self.incidencia.folio), {'motivo': 'Falsa alarma'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.estado, 'CANCELADO')

    def test_otro_usuario_no_puede_cancelar(self):
        self.client.force_authenticate(user=self.otro_usuario)
        response = self.client.post(self._url(self.incidencia.folio))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.estado, 'PENDIENTE')

    def test_no_se_puede_cancelar_un_reporte_cerrado(self):
        self.incidencia.estado = 'CERRADO'
        self.incidencia.save()

        self.client.force_authenticate(user=self.reportante)
        response = self.client.post(self._url(self.incidencia.folio))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_cancelar_con_rescate_activo_tambien_lo_cancela(self):
        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.rescatista_asignado = self.perfil_rescatista
        self.incidencia.save()
        rescate = Rescate.objects.create(
            incidencia=self.incidencia, rescatista=self.rescatista, estado='EN_CAMINO'
        )

        self.client.force_authenticate(user=self.reportante)
        response = self.client.post(self._url(self.incidencia.folio), {'motivo': 'Ya se resolvió'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rescate.refresh_from_db()
        self.incidencia.refresh_from_db()
        self.assertEqual(rescate.estado, 'CANCELADO')
        self.assertEqual(self.incidencia.estado, 'CANCELADO')

    def test_folio_inexistente_devuelve_404(self):
        self.client.force_authenticate(user=self.reportante)
        response = self.client.post(self._url('NO-EXISTE-00000'))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
