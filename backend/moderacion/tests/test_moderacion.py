from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bd.models import Animal, Incidencia, PerfilPatrocinador
from moderacion.models import ReporteFraude

Usuario = get_user_model()


def crear_incidencia(usuario_reporta=None, estado='PENDIENTE'):
    animal = Animal.objects.create(
        nombre='Luna', color='negro', tamano='mediano', tipo='perro',
        raza='mestizo', agresividad='baja', salud='estable',
    )
    return Incidencia.objects.create(
        animal=animal,
        usuario_reporta=usuario_reporta,
        ubicacion=Point(-99.1332, 19.4326, srid=4326),
        estado=estado,
    )


class ReportarFraudeTests(APITestCase):
    def setUp(self):
        self.reportante = Usuario.objects.create_user(email='reportante@example.com', password='segura123')
        self.denunciante1 = Usuario.objects.create_user(email='d1@example.com', password='segura123')
        self.denunciante2 = Usuario.objects.create_user(email='d2@example.com', password='segura123')
        self.denunciante3 = Usuario.objects.create_user(email='d3@example.com', password='segura123')
        self.incidencia = crear_incidencia(usuario_reporta=self.reportante)

    def url(self, folio):
        return reverse('reportar-fraude', kwargs={'folio': folio})

    def test_requiere_autenticacion(self):
        response = self.client.post(self.url(self.incidencia.folio))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_puede_reportar_su_propio_caso(self):
        self.client.force_authenticate(self.reportante)
        response = self.client.post(self.url(self.incidencia.folio))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'cannot_report_own_case')

    def test_reporte_incrementa_contador(self):
        self.client.force_authenticate(self.denunciante1)
        response = self.client.post(self.url(self.incidencia.folio), {'motivo': 'no existe el animal'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.reportes_fraude_count, 1)
        self.assertFalse(self.incidencia.oculto_por_fraude)
        self.assertEqual(ReporteFraude.objects.count(), 1)

    def test_no_puede_reportar_dos_veces_el_mismo_caso(self):
        self.client.force_authenticate(self.denunciante1)
        self.client.post(self.url(self.incidencia.folio))
        response = self.client.post(self.url(self.incidencia.folio))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'fraude_ya_reportado')
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.reportes_fraude_count, 1)

    def test_tercer_reporte_oculta_la_incidencia(self):
        for usuario in (self.denunciante1, self.denunciante2, self.denunciante3):
            self.client.force_authenticate(usuario)
            response = self.client.post(self.url(self.incidencia.folio))
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.reportes_fraude_count, 3)
        self.assertTrue(self.incidencia.oculto_por_fraude)

    def test_incidencia_inexistente(self):
        self.client.force_authenticate(self.denunciante1)
        response = self.client.post(self.url('ANO-EMG-99999'))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class VisibilidadOcultaPorFraudeTests(APITestCase):
    def setUp(self):
        self.rescatista = Usuario.objects.create_user(
            email='rescatista@example.com', password='segura123', roles=['RESCATISTA'],
        )
        self.incidencia_normal = crear_incidencia()
        self.incidencia_oculta = crear_incidencia()
        self.incidencia_oculta.oculto_por_fraude = True
        self.incidencia_oculta.reportes_fraude_count = 3
        self.incidencia_oculta.save(update_fields=['oculto_por_fraude', 'reportes_fraude_count'])

    def test_mapa_excluye_ocultas(self):
        response = self.client.get(reverse('incidencia-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folios = [item['folio'] for item in response.data['results']]
        self.assertIn(self.incidencia_normal.folio, folios)
        self.assertNotIn(self.incidencia_oculta.folio, folios)

    def test_disponibles_excluye_ocultas(self):
        self.client.force_authenticate(self.rescatista)
        response = self.client.get(
            reverse('rescates-disponibles'), {'lat': 19.4326, 'lng': -99.1332},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folios = [item['folio'] for item in response.data['results']]
        self.assertIn(self.incidencia_normal.folio, folios)
        self.assertNotIn(self.incidencia_oculta.folio, folios)

    def test_no_se_puede_aceptar_incidencia_oculta(self):
        self.client.force_authenticate(self.rescatista)
        response = self.client.post(reverse('aceptar-rescate', kwargs={'folio': self.incidencia_oculta.folio}))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'incidencia_oculta_por_fraude')

    def test_retrieve_sigue_funcionando_para_incidencia_oculta(self):
        response = self.client.get(reverse('incidencia-detail', kwargs={'pk': self.incidencia_oculta.pk}))
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class ColaModeracionTests(APITestCase):
    def setUp(self):
        self.admin = Usuario.objects.create_user(
            email='admin@example.com', password='segura123', is_staff=True,
        )
        self.usuario_normal = Usuario.objects.create_user(email='normal@example.com', password='segura123')

        self.incidencia_oculta = crear_incidencia()
        self.incidencia_oculta.oculto_por_fraude = True
        self.incidencia_oculta.reportes_fraude_count = 3
        self.incidencia_oculta.save(update_fields=['oculto_por_fraude', 'reportes_fraude_count'])

        self.patrocinador_usuario = Usuario.objects.create_user(email='centro@example.com', password='segura123')
        self.centro_pendiente = PerfilPatrocinador.objects.create(
            usuario=self.patrocinador_usuario,
            nombre='Refugio Pendiente', direccion='CDMX', telefono='5555555555',
            horario='9 a 17', correo='contacto@refugio.example',
        )

    def test_no_staff_no_puede_ver_la_cola(self):
        self.client.force_authenticate(self.usuario_normal)
        response = self.client.get(reverse('cola-moderacion'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_staff_ve_denuncias_y_centros_pendientes(self):
        self.client.force_authenticate(self.admin)
        response = self.client.get(reverse('cola-moderacion'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        folios = [d['folio'] for d in response.data['denuncias']]
        self.assertIn(self.incidencia_oculta.folio, folios)
        centro_ids = [c['id'] for c in response.data['centros_pendientes']]
        self.assertIn(self.centro_pendiente.id, centro_ids)

    def test_descartar_denuncia_vuelve_a_mostrar_la_incidencia(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('resolver-denuncia', kwargs={'folio': self.incidencia_oculta.folio}),
            {'accion': 'descartar'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia_oculta.refresh_from_db()
        self.assertFalse(self.incidencia_oculta.oculto_por_fraude)

    def test_confirmar_fraude_desestima_la_incidencia(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('resolver-denuncia', kwargs={'folio': self.incidencia_oculta.folio}),
            {'accion': 'confirmar_fraude'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.incidencia_oculta.refresh_from_db()
        self.assertEqual(self.incidencia_oculta.estado, 'DESESTIMADO')
        self.assertTrue(self.incidencia_oculta.oculto_por_fraude)

    def test_accion_invalida_en_resolver_denuncia(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('resolver-denuncia', kwargs={'folio': self.incidencia_oculta.folio}),
            {'accion': 'lo_que_sea'},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'accion_invalida')

    def test_aprobar_centro(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('resolver-centro', kwargs={'centro_id': self.centro_pendiente.id}),
            {'accion': 'aprobar'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.centro_pendiente.refresh_from_db()
        self.assertEqual(self.centro_pendiente.estado, 'APROBADO')

    def test_rechazar_centro_con_motivo(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse('resolver-centro', kwargs={'centro_id': self.centro_pendiente.id}),
            {'accion': 'rechazar', 'motivo_rechazo': 'Datos incompletos'},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.centro_pendiente.refresh_from_db()
        self.assertEqual(self.centro_pendiente.estado, 'RECHAZADO')
        self.assertEqual(self.centro_pendiente.motivo_rechazo, 'Datos incompletos')

    def test_no_staff_no_puede_resolver(self):
        self.client.force_authenticate(self.usuario_normal)
        response = self.client.post(
            reverse('resolver-centro', kwargs={'centro_id': self.centro_pendiente.id}),
            {'accion': 'aprobar'},
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
