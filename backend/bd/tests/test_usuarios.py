from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from bd.models import PerfilRescatista, PerfilPatrocinador

Usuario = get_user_model()

class UsuarioCRUDTests(APITestCase):
    def setUp(self):
        # URL base del ViewSet registrada en el router (usualmente /api/usuarios/)
        self.url_list = '/api/usuarios/'

        # Creamos un usuario de prueba directamente en la DB para las peticiones que exigen Auth
        self.usuario_auth = Usuario.objects.create_user(
            username='usuario_test',
            password='password_seguro',
            email='test@pawtrack.com',
            rol_principal='REPORTERO'
        )

    # ==========================================
    # PRUEBAS DE CREACIÓN (POST) - Sin Autenticación
    # ==========================================

    def test_crear_usuario_reportero_y_hash_password(self):
        """Valida la creación de un REPORTERO público y el hasheo de su contraseña."""
        data = {
            "username": "nuevo_reportero",
            "password": "mi_password_secreto",
            "email": "reportero@pawtrack.com",
            "rol_principal": "REPORTERO"
        }
        response = self.client.post(self.url_list, data)
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # Validar en base de datos
        user = Usuario.objects.get(username="nuevo_reportero")
        self.assertTrue(user.check_password("mi_password_secreto")) # Valida que pasó por set_password
        
        # Validar que NO se crearon perfiles innecesarios
        self.assertFalse(hasattr(user, 'perfil_rescatista'))
        self.assertFalse(hasattr(user, 'perfil_patrocinador'))

    def test_crear_usuario_rescatista_genera_perfil(self):
        """Valida que crear un RESCATISTA dispare la creación de PerfilRescatista."""
        data = {
            "username": "nuevo_rescatista",
            "password": "secure123",
            "rol_principal": "RESCATISTA"
        }
        response = self.client.post(self.url_list, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = Usuario.objects.get(username="nuevo_rescatista")
        self.assertTrue(hasattr(user, 'perfil_rescatista')) # Valida la relación OneToOne
        self.assertEqual(PerfilRescatista.objects.count(), 1)

    def test_crear_usuario_patrocinador_genera_perfil(self):
        """Valida que crear un PATROCINADOR dispare la creación de PerfilPatrocinador."""
        data = {
            "username": "nuevo_patrocinador",
            "password": "secure123",
            "rol_principal": "PATROCINADOR"
        }
        response = self.client.post(self.url_list, data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        user = Usuario.objects.get(username="nuevo_patrocinador")
        self.assertTrue(hasattr(user, 'perfil_patrocinador')) # Valida la relación OneToOne
        self.assertEqual(PerfilPatrocinador.objects.count(), 1)

    # ==========================================
    # PRUEBAS DE LECTURA, ACTUALIZACIÓN Y BORRADO - Con Autenticación
    # ==========================================

    def test_listar_usuarios_sin_auth_rechazado(self):
        """Valida que el GET a la lista exija token (IsAuthenticated)."""
        response = self.client.get(self.url_list)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_listar_usuarios_con_auth_exitoso(self):
        """Valida que un usuario con sesión iniciada pueda listar usuarios."""
        self.client.force_authenticate(user=self.usuario_auth) # Inyecta el usuario a la request
        response = self.client.get(self.url_list)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_actualizar_usuario_con_auth(self):
        """Valida que PATCH funcione correctamente para actualizar campos."""
        self.client.force_authenticate(user=self.usuario_auth)
        url_detail = f"{self.url_list}{self.usuario_auth.id}/"
        data_update = {"telefono": "2221234567"}
        
        response = self.client.patch(url_detail, data_update)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refrescar desde DB para asegurar persistencia
        self.usuario_auth.refresh_from_db()
        self.assertEqual(self.usuario_auth.telefono, "2221234567")

    def test_eliminar_usuario_con_auth(self):
        """Valida que DELETE destruya el registro del usuario."""
        self.client.force_authenticate(user=self.usuario_auth)
        url_detail = f"{self.url_list}{self.usuario_auth.id}/"
        
        response = self.client.delete(url_detail)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Usuario.objects.count(), 0)
