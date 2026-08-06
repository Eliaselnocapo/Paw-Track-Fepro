import threading
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth import get_user_model
from bd.models import PerfilPatrocinador, Incidencia
from .models import Recurso

Usuario = get_user_model()

class RecursoTests(APITestCase):
    def setUp(self):
        # 1. Preparar usuarios
        self.user_patrocinador = Usuario.objects.create_user(username='patrocinador', password='123')
        self.user_sin_rol = Usuario.objects.create_user(username='sinrol', password='123')
        self.user_otro = Usuario.objects.create_user(username='otro', password='123')

        # 2. Preparar perfiles (aprobados)
        self.perfil = PerfilPatrocinador.objects.create(
            usuario=self.user_patrocinador, nombre_entidad='Empresa A', aprobado=True
        )
        self.perfil_otro = PerfilPatrocinador.objects.create(
            usuario=self.user_otro, nombre_entidad='Empresa B', aprobado=True
        )

        # 3. Preparar incidencias en distintos estados
        self.incidencia_abierta = Incidencia.objects.create(titulo='Incidencia 1', estado='ABIERTA')
        self.incidencia_cerrada = Incidencia.objects.create(titulo='Incidencia 2', estado='CERRADO')

        # 4. Preparar recursos
        self.recurso_propio_abierto = Recurso.objects.create(
            patrocinador=self.perfil, incidencia=self.incidencia_abierta, tipo='Dinero', descripcion='100 USD'
        )
        self.recurso_propio_cerrado = Recurso.objects.create(
            patrocinador=self.perfil, incidencia=self.incidencia_cerrada, tipo='Alimento', descripcion='10 kg'
        )
        self.recurso_ajeno = Recurso.objects.create(
            patrocinador=self.perfil_otro, incidencia=self.incidencia_cerrada, tipo='Medicina', descripcion='Caja'
        )

    def test_usuario_sin_rol_no_ve_recursos(self):
        """Usuario sin rol solo obtiene una lista vacía y no rompe el endpoint."""
        self.client.force_authenticate(user=self.user_sin_rol)
        response = self.client.get(reverse('recursos-list'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Soporta paginación si DRF la tiene activa ('results') o lista plana
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data), 0)

    def test_patrocinador_ve_solo_sus_recursos(self):
        """Patrocinador válido obtiene exactamente los recursos que le pertenecen (paginación implícita probada en la longitud)."""
        self.client.force_authenticate(user=self.user_patrocinador)
        response = self.client.get(reverse('recursos-list'))
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data.get('results', response.data) if isinstance(response.data, dict) else response.data
        self.assertEqual(len(data), 2)

    def test_recurso_ajeno_denegado(self):
        """Bloquear intentos de liberar recursos de otro patrocinador."""
        self.client.force_authenticate(user=self.user_patrocinador)
        url = reverse('recursos-liberar', kwargs={'pk': self.recurso_ajeno.id})
        response = self.client.patch(url)
        
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('code', response.data)

    def test_liberacion_prematura(self):
        """Evitar que se libere un recurso si la incidencia no está CERRADO."""
        self.client.force_authenticate(user=self.user_patrocinador)
        url = reverse('recursos-liberar', kwargs={'pk': self.recurso_propio_abierto.id})
        response = self.client.patch(url)
        
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('code', response.data)

    def test_liberacion_correcta_y_doble_liberacion(self):
        """Validar liberación exitosa y comprobar que el endpoint sea idempotente ante llamadas repetidas."""
        self.client.force_authenticate(user=self.user_patrocinador)
        url = reverse('recursos-liberar', kwargs={'pk': self.recurso_propio_cerrado.id})
        
        # 1. Primera liberación (Debe ser OK)
        response = self.client.patch(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['estado'], 'LIBERADO')
        self.assertIsNotNone(response.data['released_at'])

        # 2. Doble liberación (Debe ser OK y devolver el mismo recurso sin crashear)
        response_doble = self.client.patch(url)
        self.assertEqual(response_doble.status_code, status.HTTP_200_OK)
        self.assertEqual(response_doble.data['estado'], 'LIBERADO')

    def test_liberacion_concurrente_idempotente(self):
        """Simula múltiples hilos intentando liberar el mismo recurso simultáneamente."""
        url = reverse('recursos-liberar', kwargs={'pk': self.recurso_propio_cerrado.id})
        resultados = []

        def hacer_peticion():
            client = self.client_class()
            client.force_authenticate(user=self.user_patrocinador)
            response = client.patch(url)
            resultados.append(response.status_code)

        # Lanzamos 5 hilos concurrentes intentando liberar el recurso al mismo tiempo
        hilos = [threading.Thread(target=hacer_peticion) for _ in range(5)]
        
        for h in hilos:
            h.start()
        for h in hilos:
            h.join()

        # Todos los hilos deben recibir un código exitoso sin romper la base de datos (idempotencia y locks)
        for status_code in resultados:
            self.assertEqual(status_code, status.HTTP_200_OK)

        # Verificamos el estado final en la base de datos
        self.recurso_propio_cerrado.refresh_from_db()
        self.assertEqual(self.recurso_propio_cerrado.estado, 'LIBERADO')
        self.assertIsNotNone(self.recurso_propio_cerrado.released_at)