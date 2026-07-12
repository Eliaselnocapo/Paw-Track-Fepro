from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point
from django.core.files.uploadedfile import SimpleUploadedFile

from bd.models import Usuario, Incidencia, Animal, PerfilRescatista
from rescates.models import Rescate


class CancelarRescateTests(APITestCase):
    """POST /rescates/{id}/cancelar/ — el voluntario cancela su propio
    rescate: la Incidencia regresa a PENDIENTE y se desasigna al rescatista."""

    def setUp(self):
        self.rescatista = Usuario.objects.create_user(
            email='rescatista@test.com', password='password123', roles=['RESCATISTA']
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.rescatista)
        self.otro_rescatista = Usuario.objects.create_user(
            email='otro@test.com', password='password123', roles=['RESCATISTA']
        )
        self.reportante = Usuario.objects.create_user(
            email='reportante@test.com', password='password123', roles=['REPORTERO']
        )
        self.animal = Animal.objects.create(nombre="Max", tipo="PERRO", salud="HERIDO")
        self.punto = Point(-98.2062, 19.0414, srid=4326)
        self.incidencia = Incidencia.objects.create(
            tipo_incidencia="EMERGENCIA", estado="ATENDIENDOSE",
            usuario_reporta=self.reportante, animal=self.animal, ubicacion=self.punto,
            rescatista_asignado=self.perfil_rescatista,
        )
        self.rescate = Rescate.objects.create(
            incidencia=self.incidencia, rescatista=self.rescatista, estado='EN_CAMINO'
        )

    def test_cancelar_revierte_incidencia_a_pendiente_y_desasigna(self):
        self.client.force_authenticate(user=self.rescatista)
        url = reverse('cancelar-rescate', kwargs={'rescate_id': self.rescate.id})
        response = self.client.post(url, {'motivo': 'Se complicó, no puedo llegar'})

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.rescate.refresh_from_db()
        self.incidencia.refresh_from_db()
        self.assertEqual(self.rescate.estado, 'CANCELADO')
        self.assertEqual(self.rescate.historial[-1]['motivo'], 'Se complicó, no puedo llegar')
        self.assertEqual(self.incidencia.estado, 'PENDIENTE')
        self.assertIsNone(self.incidencia.rescatista_asignado)

    def test_caso_reaparece_en_disponibles_tras_cancelar(self):
        self.client.force_authenticate(user=self.rescatista)
        url = reverse('cancelar-rescate', kwargs={'rescate_id': self.rescate.id})
        self.client.post(url)

        self.client.force_authenticate(user=self.otro_rescatista)
        url_disponibles = reverse('rescates-disponibles')
        response = self.client.get(url_disponibles, {'lat': 19.0414, 'lng': -98.2062})

        folios = [r['folio'] for r in response.data['results']]
        self.assertIn(self.incidencia.folio, folios)

    def test_rescatista_ajeno_no_puede_cancelar(self):
        self.client.force_authenticate(user=self.otro_rescatista)
        url = reverse('cancelar-rescate', kwargs={'rescate_id': self.rescate.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_no_se_puede_cancelar_un_rescate_completado(self):
        self.rescate.estado = 'COMPLETADO'
        self.rescate.save()

        self.client.force_authenticate(user=self.rescatista)
        url = reverse('cancelar-rescate', kwargs={'rescate_id': self.rescate.id})
        response = self.client.post(url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_estado_view_generico_ya_no_acepta_cancelado(self):
        """ActualizarEstadoView (PATCH /estado/) ya no debe aceptar CANCELADO
        — ese estado ahora tiene efectos secundarios que solo maneja
        CancelarRescateView."""
        self.client.force_authenticate(user=self.rescatista)
        url = reverse('actualizar-estado-rescate', kwargs={'rescate_id': self.rescate.id})
        response = self.client.patch(url, {'estado': 'CANCELADO'})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FotoCierreEnHistorialTests(APITestCase):
    """El historial de COMPLETADO debe incluir la URL de la foto de
    evidencia, no solo las coordenadas de cierre."""

    def setUp(self):
        self.rescatista = Usuario.objects.create_user(
            email='rescatista2@test.com', password='password123', roles=['RESCATISTA']
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.rescatista)
        self.reportante = Usuario.objects.create_user(
            email='reportante2@test.com', password='password123', roles=['REPORTERO']
        )
        self.animal = Animal.objects.create(nombre="Luna", tipo="GATO", salud="ESTABLE")
        self.punto = Point(-98.2062, 19.0414, srid=4326)
        self.incidencia = Incidencia.objects.create(
            tipo_incidencia="EMERGENCIA", estado="ATENDIENDOSE",
            usuario_reporta=self.reportante, animal=self.animal, ubicacion=self.punto,
            rescatista_asignado=self.perfil_rescatista,
        )
        self.rescate = Rescate.objects.create(
            incidencia=self.incidencia, rescatista=self.rescatista, estado='EN_SITIO'
        )

    def test_historial_completado_incluye_foto_cierre(self):
        self.client.force_authenticate(user=self.rescatista)
        url = reverse('cerrar-rescate', kwargs={'rescate_id': self.rescate.id})
        foto = SimpleUploadedFile('evidencia.jpg', b'contenido-falso', content_type='image/jpeg')

        response = self.client.post(url, {'lat': 19.0414, 'lng': -98.2062, 'foto': foto}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.rescate.refresh_from_db()
        entrada = self.rescate.historial[-1]
        self.assertEqual(entrada['estado'], 'COMPLETADO')
        self.assertIsNotNone(entrada['foto_cierre'])
        self.assertIn('evidencia', entrada['foto_cierre'])
