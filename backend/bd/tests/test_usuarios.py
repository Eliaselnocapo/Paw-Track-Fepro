from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from bd.models import PerfilRescatista, PerfilPatrocinador

Usuario = get_user_model()


def crear_usuario(email='test@pawtrack.com', roles=None, password='Perro999Verde'):
    roles = roles or ['REPORTERO']
    username = email.split('@')[0]
    return Usuario.objects.create_user(
        username=username,
        password=password,
        email=email,
        roles=roles,
    )


class UsuarioCRUDTests(APITestCase):

    def setUp(self):
        self.url_list = '/api/usuarios/'
        self.usuario_auth = crear_usuario()

    # --- Creación ---

    def test_crear_usuario_reportero_hash_password(self):
        """El endpoint público POST /api/usuarios/ crea un REPORTERO y hashea su contraseña."""
        data = {
            'username': 'nuevo_reportero',
            'password': 'Perro999Verde',
            'email': 'reportero@pawtrack.com',
            'roles': ['REPORTERO'],
        }
        response = self.client.post(self.url_list, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = Usuario.objects.get(username='nuevo_reportero')
        self.assertTrue(user.check_password('Perro999Verde'))
        self.assertFalse(hasattr(user, 'perfil_rescatista'))
        self.assertFalse(hasattr(user, 'perfil_patrocinador'))

    def test_crear_usuario_rescatista_genera_perfil(self):
        """Crear un RESCATISTA dispara la creación automática de PerfilRescatista."""
        data = {
            'username': 'nuevo_rescatista',
            'password': 'Perro999Verde',
            'email': 'rescatista@pawtrack.com',
            'roles': ['RESCATISTA'],
        }
        response = self.client.post(self.url_list, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        user = Usuario.objects.get(username='nuevo_rescatista')
        self.assertTrue(hasattr(user, 'perfil_rescatista'))
        self.assertEqual(PerfilRescatista.objects.count(), 1)

    def test_crear_usuario_rol_invalido_rechazado(self):
        """Roles fuera de la lista válida deben ser rechazados con 400."""
        data = {
            'username': 'hacker',
            'password': 'Perro999Verde',
            'email': 'hacker@pawtrack.com',
            'roles': ['ADMIN'],
        }
        response = self.client.post(self.url_list, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # --- Lectura ---

    def test_listar_usuarios_sin_auth_rechazado(self):
        """GET /api/usuarios/ sin token devuelve 401."""
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_listar_usuarios_con_auth(self):
        """Un usuario autenticado puede listar todos los usuarios."""
        self.client.force_authenticate(user=self.usuario_auth)
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_listar_usuarios_incluye_roles(self):
        """La respuesta incluye el campo roles con al menos un valor válido."""
        self.client.force_authenticate(user=self.usuario_auth)
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        primer_usuario = response.data[0]
        self.assertIn('roles', primer_usuario)
        self.assertIsInstance(primer_usuario['roles'], list)

    # --- Actualización ---

    def test_actualizar_telefono(self):
        """PATCH /api/usuarios/{id}/ actualiza el teléfono correctamente."""
        self.client.force_authenticate(user=self.usuario_auth)
        url = f'{self.url_list}{self.usuario_auth.id}/'
        response = self.client.patch(url, {'telefono': '2221234567'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.usuario_auth.refresh_from_db()
        self.assertEqual(self.usuario_auth.telefono, '2221234567')

    # --- Eliminación ---

    def test_eliminar_usuario(self):
        """DELETE /api/usuarios/{id}/ elimina el registro de la base de datos."""
        self.client.force_authenticate(user=self.usuario_auth)
        url = f'{self.url_list}{self.usuario_auth.id}/'
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Usuario.objects.filter(id=self.usuario_auth.id).exists())
