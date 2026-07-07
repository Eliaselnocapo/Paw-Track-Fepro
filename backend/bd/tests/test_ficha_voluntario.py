from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from django.contrib.gis.geos import Point

from bd.models import Usuario, Animal, Incidencia, PerfilRescatista


class FichaVoluntarioTests(APITestCase):
    """El reportante y el voluntario ya no comparten `caracteristicas`: cada
    uno escribe en su propio campo (seguimiento vs. ficha clínica)."""

    def setUp(self):
        self.user_reportero = Usuario.objects.create_user(
            email='reportero@test.com',
            password='pass123',
            roles=['REPORTERO'],
        )
        self.user_rescatista = Usuario.objects.create_user(
            email='rescatista@test.com',
            password='pass123',
            roles=['RESCATISTA'],
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.user_rescatista)

        self.animal = Animal.objects.create(nombre='Firulais', tipo='PERRO', salud='HERIDO')
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.user_reportero,
            animal=self.animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            estado='ATENDIENDOSE',
            rescatista_asignado=self.perfil_rescatista,
        )
        self.url_detail = reverse('incidencia-detail', kwargs={'pk': self.incidencia.pk})

    def test_rescatista_escribe_ficha_voluntario_sin_tocar_caracteristicas(self):
        self.incidencia.caracteristicas = 'Nota del reportante'
        self.incidencia.save(update_fields=['caracteristicas'])

        self.client.force_authenticate(user=self.user_rescatista)
        response = self.client.patch(
            self.url_detail,
            {'ficha_voluntario': 'Sexo: macho, esterilizado', 'caracteristicas': 'intento de pisar'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.ficha_voluntario, 'Sexo: macho, esterilizado')
        self.assertEqual(self.incidencia.caracteristicas, 'Nota del reportante')

    def test_reportante_escribe_caracteristicas_sin_tocar_ficha_voluntario(self):
        self.incidencia.estado = 'PENDIENTE'
        self.incidencia.rescatista_asignado = None
        self.incidencia.ficha_voluntario = 'Ficha clínica previa'
        self.incidencia.save(update_fields=['estado', 'rescatista_asignado', 'ficha_voluntario'])

        self.client.force_authenticate(user=self.user_reportero)
        response = self.client.patch(
            self.url_detail,
            {'caracteristicas': 'Sigue en el mismo lugar', 'ficha_voluntario': 'intento de pisar'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.caracteristicas, 'Sigue en el mismo lugar')
        self.assertEqual(self.incidencia.ficha_voluntario, 'Ficha clínica previa')

    def test_ficha_voluntario_presente_en_respuesta(self):
        self.client.force_authenticate(user=self.user_rescatista)
        response = self.client.get(self.url_detail)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('ficha_voluntario', response.data)
