from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from bd.models import PerfilRescatista

Usuario = get_user_model()

REGISTRO_URL = '/api/auth/registration/'
LOGIN_URL    = '/api/auth/login/'


class RegistroTests(APITestCase):

    def test_registro_basico_retorna_tokens(self):
        """POST /api/auth/registration/ devuelve access y refresh no vacíos."""
        response = self.client.post(REGISTRO_URL, {
            'email': 'nuevo@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
            'first_name': 'Nuevo',
            'last_name': 'Usuario',
            'roles': ['REPORTERO'],
        }, format='json')

        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertNotEqual(response.data['access'], '')
        self.assertNotEqual(response.data['refresh'], '')

    def test_registro_persiste_usuario_en_db(self):
        """El usuario registrado existe en la base de datos con los datos correctos."""
        self.client.post(REGISTRO_URL, {
            'email': 'ana@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
            'first_name': 'Ana',
            'last_name': 'López',
            'roles': ['RESCATISTA'],
        }, format='json')

        user = Usuario.objects.get(email='ana@test.com')
        self.assertEqual(user.first_name, 'Ana')
        self.assertEqual(user.last_name, 'López')
        self.assertIn('RESCATISTA', user.roles)

    def test_registro_rescatista_crea_perfil(self):
        """Registrar un RESCATISTA crea automáticamente su PerfilRescatista."""
        self.client.post(REGISTRO_URL, {
            'email': 'rescatista@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
            'roles': ['RESCATISTA'],
        }, format='json')

        user = Usuario.objects.get(email='rescatista@test.com')
        self.assertTrue(PerfilRescatista.objects.filter(usuario=user).exists())

    def test_registro_passwords_distintos_rechazado(self):
        """Las contraseñas que no coinciden devuelven 400."""
        response = self.client.post(REGISTRO_URL, {
            'email': 'mal@test.com',
            'password1': 'Perro999Verde',
            'password2': 'OtraPassword123',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_email_duplicado_rechazado(self):
        """Registrar el mismo email dos veces devuelve 400 en el segundo intento."""
        payload = {
            'email': 'dup@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
        }
        self.client.post(REGISTRO_URL, payload, format='json')
        response = self.client.post(REGISTRO_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registro_sin_rol_asigna_reportero(self):
        """Si no se envía roles, el usuario queda como REPORTERO por defecto."""
        self.client.post(REGISTRO_URL, {
            'email': 'sinrol@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
        }, format='json')
        user = Usuario.objects.get(email='sinrol@test.com')
        self.assertIn('REPORTERO', user.roles)


class LoginTests(APITestCase):

    def setUp(self):
        self.user = Usuario.objects.create_user(
            email='login@test.com',
            password='Perro999Verde',
            roles=['REPORTERO'],
        )

    def test_login_correcto_retorna_tokens_y_usuario(self):
        """Login con credenciales correctas devuelve access, refresh y objeto user."""
        response = self.client.post(LOGIN_URL, {
            'email': 'login@test.com',
            'password': 'Perro999Verde',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertNotEqual(response.data['refresh'], '')
        self.assertEqual(response.data['user']['email'], 'login@test.com')

    def test_login_retorna_roles_del_usuario(self):
        """El objeto user en la respuesta incluye el campo roles."""
        response = self.client.post(LOGIN_URL, {
            'email': 'login@test.com',
            'password': 'Perro999Verde',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('roles', response.data['user'])
        self.assertIsInstance(response.data['user']['roles'], list)

    def test_login_password_incorrecto_rechazado(self):
        """Contraseña incorrecta devuelve 400 con non_field_errors."""
        response = self.client.post(LOGIN_URL, {
            'email': 'login@test.com',
            'password': 'wrongpass',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('non_field_errors', response.data)

    def test_login_email_inexistente_rechazado(self):
        """Email que no existe devuelve 400."""
        response = self.client.post(LOGIN_URL, {
            'email': 'noexiste@test.com',
            'password': 'Perro999Verde',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_campos_vacios_rechazado(self):
        """Request sin email ni password devuelve 400."""
        response = self.client.post(LOGIN_URL, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
