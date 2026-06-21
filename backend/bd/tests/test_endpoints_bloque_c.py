from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.gis.geos import Point
from bd.models import Usuario, Incidencia, Animal, PerfilRescatista

class BloqueCEndpointsTests(APITestCase):
    def setUp(self):
        # 1. Crear usuarios de prueba
        self.usuario_comun = Usuario.objects.create_user(
            email='comun@test.com', 
            password='testpassword123', 
            roles=['REPORTERO']
        )
        self.usuario_otro = Usuario.objects.create_user(
            email='otro@test.com', 
            password='testpassword123', 
            roles=['REPORTERO']
        )
        self.usuario_staff = Usuario.objects.create_user(
            email='staff@test.com', 
            password='testpassword123', 
            is_staff=True
        )

        # 2. Crear datos para la incidencia
        self.animal = Animal.objects.create(nombre="Max", tipo="perro")
        self.incidencia = Incidencia.objects.create(
            usuario_reporta=self.usuario_comun,
            animal=self.animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326), # Longitud primero
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE'
        )

    # --- TESTS PARA EL ENDPOINT DE SEGUIMIENTO ---

    def test_seguimiento_exitoso(self):
        """Verifica que un folio válido retorne 200 y los datos correctos."""
        url = reverse('incidencia-seguimiento', kwargs={'folio': self.incidencia.folio})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['folio'], self.incidencia.folio)
        self.assertEqual(response.data['estado'], 'PENDIENTE')
        self.assertEqual(response.data['tipo_animal'], 'perro')

    def test_seguimiento_folio_invalido(self):
        """Verifica que un folio inexistente retorne 404 con el código de error estándar."""
        url = reverse('incidencia-seguimiento', kwargs={'folio': 'FOLIO-FALSO-001'})
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['code'], 'not_found')

    # --- TESTS PARA EL ENDPOINT DE ROLES ---

    def test_add_roles_rescatista_exitoso(self):
        """Verifica que un usuario pueda autoasignarse el rol RESCATISTA y se cree su perfil."""
        self.client.force_authenticate(user=self.usuario_comun)
        url = f'/api/usuarios/{self.usuario_comun.id}/roles/'
        
        response = self.client.patch(url, {'roles': ['RESCATISTA']}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.usuario_comun.refresh_from_db()
        self.assertIn('RESCATISTA', self.usuario_comun.roles)
        # Verifica que el Signal o la vista haya creado el PerfilRescatista
        self.assertTrue(PerfilRescatista.objects.filter(usuario=self.usuario_comun).exists())

    def test_add_roles_patrocinador_rechazado(self):
        """Verifica que el rol PATROCINADOR sea rechazado para usuarios normales."""
        self.client.force_authenticate(user=self.usuario_comun)
        url = f'/api/usuarios/{self.usuario_comun.id}/roles/'
        
        response = self.client.patch(url, {'roles': ['PATROCINADOR']}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'role_requires_approval')

    def test_add_roles_patrocinador_staff_exitoso(self):
        """Verifica que un admin (staff) sí pueda asignar el rol PATROCINADOR."""
        self.client.force_authenticate(user=self.usuario_staff)
        url = f'/api/usuarios/{self.usuario_staff.id}/roles/'
        
        response = self.client.patch(url, {'roles': ['PATROCINADOR']}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.usuario_staff.refresh_from_db()
        self.assertIn('PATROCINADOR', self.usuario_staff.roles)

    def test_add_roles_ajeno_rechazado(self):
        """Verifica que un usuario no pueda modificar los roles de otro (IsOwner)."""
        self.client.force_authenticate(user=self.usuario_comun)
        url = f'/api/usuarios/{self.usuario_otro.id}/roles/'
        
        response = self.client.patch(url, {'roles': ['RESCATISTA']}, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'not_owner')
