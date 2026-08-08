import threading

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.db import close_old_connections
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bd.models import Animal, Incidencia, PerfilPatrocinador

from recursos.models import Recurso
from recursos.services import liberar_recurso


Usuario = get_user_model()


def crear_incidencia(estado='PENDIENTE'):
    animal = Animal.objects.create(
        nombre='Luna', color='negro', tamano='mediano', tipo='perro',
        raza='mestizo', agresividad='baja', salud='estable',
    )
    return Incidencia.objects.create(
        animal=animal,
        ubicacion=Point(-99.1332, 19.4326, srid=4326),
        estado=estado,
    )


class RecursoTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='patrocinador@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        self.otro_usuario = Usuario.objects.create_user(
            email='otro@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        self.no_patrocinador = Usuario.objects.create_user(
            email='reportero@example.com', password='segura123',
            roles=['REPORTERO'],
        )
        self.patrocinador = PerfilPatrocinador.objects.create(
            usuario=self.usuario,
            nombre='Refugio A', direccion='CDMX',
            telefono='5555555555',
            horario='9 a 17', correo='contacto@refugioa.example', estado='APROBADO',
        )
        self.otro_patrocinador = PerfilPatrocinador.objects.create(
            usuario=self.otro_usuario,
            nombre='Refugio B', direccion='CDMX',
            telefono='5555555556',
            horario='9 a 17', correo='contacto@refugiob.example', estado='APROBADO',
        )
        self.incidencia_abierta = crear_incidencia()
        self.incidencia_cerrada = crear_incidencia('CERRADO')
        self.recurso_abierto = Recurso.objects.create(
            patrocinador=self.patrocinador, incidencia=self.incidencia_abierta,
            tipo='alimento',
        )
        self.recurso_cerrado = Recurso.objects.create(
            patrocinador=self.patrocinador, incidencia=self.incidencia_cerrada,
            tipo='veterinario',
        )
        self.recurso_ajeno = Recurso.objects.create(
            patrocinador=self.otro_patrocinador, incidencia=self.incidencia_cerrada,
            tipo='transporte',
        )

    def test_requiere_patrocinador_autenticado(self):
        self.assertEqual(self.client.get(reverse('recursos-list')).status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.force_authenticate(self.no_patrocinador)
        self.assertEqual(self.client.get(reverse('recursos-list')).status_code, status.HTTP_403_FORBIDDEN)

    def test_lista_solo_recursos_propios(self):
        self.client.force_authenticate(self.usuario)
        response = self.client.get(reverse('recursos-list'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_crea_recurso_bloqueado_para_caso_activo(self):
        self.client.force_authenticate(self.usuario)
        response = self.client.post(reverse('recursos-list'), {
            'incidencia': self.incidencia_abierta.id,
            'tipo': 'medicina',
            'descripcion': 'Antibiotico',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['estado'], 'BLOQUEADO')
        self.assertEqual(response.data['patrocinador'], self.patrocinador.id)

    def test_no_crea_recurso_para_caso_cerrado(self):
        self.client.force_authenticate(self.usuario)
        response = self.client.post(reverse('recursos-list'), {
            'incidencia': self.incidencia_cerrada.id,
            'tipo': 'medicina',
        })
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['code'], 'resource_not_assignable')

    def test_no_libera_recurso_ajeno_ni_prematuro(self):
        self.client.force_authenticate(self.usuario)
        ajeno = self.client.patch(reverse('recursos-liberar', kwargs={'pk': self.recurso_ajeno.id}))
        prematuro = self.client.patch(reverse('recursos-liberar', kwargs={'pk': self.recurso_abierto.id}))
        self.assertEqual(ajeno.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(ajeno.data['code'], 'not_owner')
        self.assertEqual(prematuro.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(prematuro.data['code'], 'resource_not_releasable')

    def test_liberacion_es_idempotente(self):
        self.client.force_authenticate(self.usuario)
        url = reverse('recursos-liberar', kwargs={'pk': self.recurso_cerrado.id})
        primera = self.client.patch(url)
        segunda = self.client.patch(url)
        self.assertEqual(primera.status_code, status.HTTP_200_OK)
        self.assertEqual(segunda.status_code, status.HTTP_200_OK)
        self.assertEqual(primera.data['released_at'], segunda.data['released_at'])


class RecursoConcurrenciaTests(TransactionTestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='concurrencia@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        patrocinador = PerfilPatrocinador.objects.create(
            usuario=self.usuario,
            nombre='Refugio Concurrente', direccion='CDMX',
            telefono='5555555557',
            horario='9 a 17', correo='concurrencia@refugio.example', estado='APROBADO',
        )
        self.recurso = Recurso.objects.create(
            patrocinador=patrocinador,
            incidencia=crear_incidencia('CERRADO'),
            tipo='transporte',
        )

    def test_liberacion_concurrente_es_idempotente(self):
        errores = []

        def liberar():
            close_old_connections()
            try:
                liberar_recurso(self.recurso.id, self.usuario)
            except Exception as error:  # pragma: no cover - solo captura fallas del hilo
                errores.append(error)
            finally:
                close_old_connections()

        hilos = [threading.Thread(target=liberar) for _ in range(5)]
        for hilo in hilos:
            hilo.start()
        for hilo in hilos:
            hilo.join()

        self.assertEqual(errores, [])
        self.recurso.refresh_from_db()
        self.assertEqual(self.recurso.estado, 'LIBERADO')
        self.assertIsNotNone(self.recurso.released_at)
