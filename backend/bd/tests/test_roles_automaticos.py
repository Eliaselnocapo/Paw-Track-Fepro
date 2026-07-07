from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model

from bd.models import PerfilRescatista

Usuario = get_user_model()

REGISTRO_URL = '/api/auth/registration/'


class RolesAutomaticosEnRegistroTests(APITestCase):
    """Ya no hay selector de rol en el registro: todo usuario nuevo queda
    como REPORTERO + RESCATISTA sin importar lo que mande el front."""

    def test_registro_sin_roles_asigna_ambos_por_defecto(self):
        response = self.client.post(REGISTRO_URL, {
            'email': 'ambos@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = Usuario.objects.get(email='ambos@test.com')
        self.assertIn('REPORTERO', user.roles)
        self.assertIn('RESCATISTA', user.roles)
        self.assertTrue(PerfilRescatista.objects.filter(usuario=user).exists())

    def test_registro_mandando_un_solo_rol_igual_recibe_ambos(self):
        """Aunque el front mande roles:['REPORTERO'] (front viejo sin actualizar),
        el backend fuerza el par completo."""
        response = self.client.post(REGISTRO_URL, {
            'email': 'solounrol@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
            'roles': ['REPORTERO'],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = Usuario.objects.get(email='solounrol@test.com')
        self.assertIn('REPORTERO', user.roles)
        self.assertIn('RESCATISTA', user.roles)

    def test_registro_con_patrocinador_lo_agrega_ademas_del_par_base(self):
        """PATROCINADOR sigue siendo opt-in explícito, no forma parte del par automático."""
        response = self.client.post(REGISTRO_URL, {
            'email': 'patrocinador@test.com',
            'password1': 'Perro999Verde',
            'password2': 'Perro999Verde',
            'roles': ['PATROCINADOR'],
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = Usuario.objects.get(email='patrocinador@test.com')
        self.assertIn('REPORTERO', user.roles)
        self.assertIn('RESCATISTA', user.roles)
        self.assertIn('PATROCINADOR', user.roles)
