from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse

from bd.models import Usuario


class EditarPerfilTests(APITestCase):
    """PATCH /api/auth/user/ — el usuario logueado edita su propio perfil.
    NO editable: email, password, rol (se ignoran silenciosamente si llegan)."""

    def setUp(self):
        self.user = Usuario.objects.create_user(
            email='perfil@test.com', password='ClaveOriginal123', roles=['REPORTERO'],
            first_name='Ana', last_name='López',
        )
        self.url = reverse('mi-perfil')

    def test_actualiza_campos_editables(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, {
            'first_name': 'Ana María',
            'telefono': '5512345678',
            'ubicacion': 'CDMX',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Ana María')
        self.assertEqual(self.user.telefono, '5512345678')
        self.assertEqual(self.user.ubicacion, 'CDMX')

    def test_devuelve_usuario_completo_no_solo_los_campos_editados(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, {'telefono': '5500000000'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('roles', response.data)
        self.assertIn('email', response.data)
        self.assertEqual(response.data['email'], 'perfil@test.com')

    def test_email_enviado_se_ignora(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, {'email': 'otro@test.com'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'perfil@test.com')

    def test_password_enviado_se_ignora_y_no_corrompe_el_hash(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, {'password': 'nuevaclaveSinHashear'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('ClaveOriginal123'))

    def test_roles_enviado_se_ignora(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.patch(self.url, {'roles': ['RESCATISTA', 'PATROCINADOR']}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.roles, ['REPORTERO'])

    def test_get_incluye_los_campos_nuevos(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for campo in ('telefono', 'ubicacion', 'foto_perfil'):
            self.assertIn(campo, response.data)

    def test_sin_autenticacion_rechazado(self):
        response = self.client.patch(self.url, {'telefono': '555'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
