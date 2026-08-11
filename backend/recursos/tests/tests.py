import threading

from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.db import IntegrityError, close_old_connections, transaction
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from bd.models import Animal, Incidencia, PerfilPatrocinador, PerfilRescatista

from recursos.models import HistorialRecurso, Recurso
from recursos.services import asignar_recurso, liberar_recurso


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


class SponsorAprobacionTests(APITestCase):
    def setUp(self):
        self.usuario_pendiente = Usuario.objects.create_user(
            email='pendiente@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        PerfilPatrocinador.objects.create(
            usuario=self.usuario_pendiente,
            nombre='Refugio Pendiente', direccion='CDMX',
            telefono='5555555558',
            horario='9 a 17', correo='pendiente@refugio.example',
            # estado por default: PENDIENTE (no se pasa explícito para
            # probar justo ese default, no solo el caso ya-aprobado)
        )
        self.incidencia = crear_incidencia()

    def test_patrocinador_pendiente_no_puede_asignar_recurso(self):
        self.client.force_authenticate(self.usuario_pendiente)
        response = self.client.post(reverse('recursos-list'), {
            'incidencia': self.incidencia.id,
            'tipo': 'alimento',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'sponsor_not_approved')
        self.assertFalse(Recurso.objects.filter(incidencia=self.incidencia).exists())


class RecursoConstraintTests(APITestCase):
    """Constraint de BD: LIBERADO siempre con released_at, BLOQUEADO nunca.
    Se prueba a nivel ORM directo (sin pasar por services) porque el
    objetivo es confirmar que la base de datos rechaza el estado incoherente
    incluso si algún código nuevo se saltara la validación de services.py."""

    def setUp(self):
        self.patrocinador = PerfilPatrocinador.objects.create(
            usuario=Usuario.objects.create_user(
                email='constraint@example.com', password='segura123',
                roles=['PATROCINADOR'],
            ),
            nombre='Refugio Constraint', direccion='CDMX',
            telefono='5555555559', horario='9 a 17',
            correo='constraint@refugio.example', estado='APROBADO',
        )
        self.incidencia = crear_incidencia()

    def test_no_permite_liberado_sin_released_at(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Recurso.objects.create(
                    patrocinador=self.patrocinador, incidencia=self.incidencia,
                    tipo='alimento', estado='LIBERADO', released_at=None,
                )

    def test_no_permite_bloqueado_con_released_at(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Recurso.objects.create(
                    patrocinador=self.patrocinador, incidencia=self.incidencia,
                    tipo='alimento', estado='BLOQUEADO', released_at=timezone.now(),
                )


class TrazabilidadRecursoTests(APITestCase):
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='trazabilidad@example.com', password='segura123',
            roles=['PATROCINADOR'],
        )
        self.patrocinador = PerfilPatrocinador.objects.create(
            usuario=self.usuario,
            nombre='Refugio Trazabilidad', direccion='CDMX',
            telefono='5555555560', horario='9 a 17',
            correo='trazabilidad@refugio.example', estado='APROBADO',
        )
        # Abierta para poder asignar; cada test la cierra antes de liberar
        # (no se puede asignar un recurso sobre un caso ya CERRADO).
        self.incidencia = crear_incidencia()

    def test_asignar_y_liberar_registran_historial(self):
        recurso = asignar_recurso(self.usuario, self.incidencia.id, 'alimento')
        eventos = list(HistorialRecurso.objects.filter(recurso=recurso).order_by('timestamp'))
        self.assertEqual(len(eventos), 1)
        self.assertEqual(eventos[0].tipo_evento, 'ASIGNADO')
        self.assertEqual(eventos[0].actor_id, self.usuario.id)

        self.incidencia.estado = 'CERRADO'
        self.incidencia.save(update_fields=['estado'])
        liberar_recurso(recurso.id, self.usuario)
        eventos = list(HistorialRecurso.objects.filter(recurso=recurso).order_by('timestamp'))
        self.assertEqual(len(eventos), 2)
        self.assertEqual(eventos[1].tipo_evento, 'LIBERADO')

    def test_reintentar_liberar_no_duplica_evento(self):
        recurso = asignar_recurso(self.usuario, self.incidencia.id, 'alimento')
        self.incidencia.estado = 'CERRADO'
        self.incidencia.save(update_fields=['estado'])
        liberar_recurso(recurso.id, self.usuario)
        liberar_recurso(recurso.id, self.usuario)
        eventos_liberado = HistorialRecurso.objects.filter(recurso=recurso, tipo_evento='LIBERADO')
        self.assertEqual(eventos_liberado.count(), 1)


class RecursosDeIncidenciaViewTests(APITestCase):
    def setUp(self):
        self.rescatista_usuario = Usuario.objects.create_user(
            email='rescatista-lectura@example.com', password='segura123',
            roles=['RESCATISTA'],
        )
        self.perfil_rescatista = PerfilRescatista.objects.create(usuario=self.rescatista_usuario)

        self.rescatista_ajeno_usuario = Usuario.objects.create_user(
            email='rescatista-ajeno@example.com', password='segura123',
            roles=['RESCATISTA'],
        )
        PerfilRescatista.objects.create(usuario=self.rescatista_ajeno_usuario)

        self.reportero = Usuario.objects.create_user(
            email='reportero-lectura@example.com', password='segura123',
            roles=['REPORTERO'],
        )

        self.patrocinador = PerfilPatrocinador.objects.create(
            usuario=Usuario.objects.create_user(
                email='patrocinador-lectura@example.com', password='segura123',
                roles=['PATROCINADOR'],
            ),
            nombre='Refugio Lectura', direccion='CDMX',
            telefono='5555555561', horario='9 a 17',
            correo='lectura@refugio.example', estado='APROBADO',
        )

        self.incidencia = crear_incidencia()
        self.incidencia.rescatista_asignado = self.perfil_rescatista
        self.incidencia.save(update_fields=['rescatista_asignado'])

        self.recurso = Recurso.objects.create(
            patrocinador=self.patrocinador, incidencia=self.incidencia, tipo='alimento',
        )

    def _url(self):
        return f'/api/incidencias/{self.incidencia.folio}/recursos/'

    def test_rescatista_asignado_ve_los_recursos_de_su_caso(self):
        self.client.force_authenticate(self.rescatista_usuario)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['tipo'], 'alimento')
        # No expone el id del patrocinador especifico, solo el estado del recurso
        self.assertNotIn('patrocinador', response.data[0])

    def test_rescatista_ajeno_no_ve_recursos_de_otro_caso(self):
        self.client.force_authenticate(self.rescatista_ajeno_usuario)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'not_assigned_rescatista')

    def test_usuario_sin_perfil_rescatista_no_ve_recursos(self):
        self.client.force_authenticate(self.reportero)
        response = self.client.get(self._url())
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data['code'], 'not_assigned_rescatista')

    def test_folio_inexistente_devuelve_404(self):
        self.client.force_authenticate(self.rescatista_usuario)
        response = self.client.get('/api/incidencias/NO-EXISTE-00000/recursos/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data['code'], 'not_found')