from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from bd.models import Usuario, Incidencia, Animal, PerfilRescatista

class RescatesEndpointsTests(APITestCase):
    def setUp(self):
        # Crear usuario Rescatista
        self.user_rescatista = Usuario.objects.create_user(
            email='rescatista@test.com',
            password='password123',
            roles=['RESCATISTA']
        )

        self.perfil_rescatista = PerfilRescatista.objects.create(
             usuario=self.user_rescatista
                    
         )
        
        #  Crear usuario normal (Reportero)
        self.user_normal = Usuario.objects.create_user(
            email='normal@test.com',
            password='password123',
            roles=['REPORTERO']
        )
        
        # Crear Animal Base para la incidencia
        self.animal = Animal.objects.create(
            nombre="Max",
            tipo="PERRO",
            salud="HERIDO"
        )
        
        self.incidencia = Incidencia.objects.create(
             tipo_incidencia="RESCATE_URGENTE",
             estado="PENDIENTE",
             usuario_reporta=self.user_normal,
             animal=self.animal,
             ubicacion="POINT(-98.2062 19.0414)" 
        )

    def test_rescatista_puede_aceptar_incidencia(self):
        """Un usuario con rol RESCATISTA debe poder aceptar la incidencia y crear el registro de Rescate."""
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        # Debe ser exitoso
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # La incidencia debe actualizarse
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.estado, 'ATENDIENDOSE')
        self.assertEqual(self.incidencia.rescatista_asignado, self.perfil_rescatista)

    def test_usuario_normal_no_puede_aceptar(self):
        """Un usuario sin el rol RESCATISTA debe recibir un 403 Forbidden."""
        self.client.force_authenticate(user=self.user_normal)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
    def test_no_se_puede_aceptar_incidencia_no_pendiente(self):
        """Si la incidencia ya está ATENDIENDOSE o CERRADA, debe devolver 400 Bad Request."""
        # Cambiamos el estado manualmente
        self.incidencia.estado = 'ATENDIENDOSE'
        self.incidencia.save()
        
        self.client.force_authenticate(user=self.user_rescatista)
        url = reverse('aceptar-rescate', kwargs={'folio': self.incidencia.folio})
        
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
