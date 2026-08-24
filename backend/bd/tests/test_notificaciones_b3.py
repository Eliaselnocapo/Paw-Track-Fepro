"""
Tests para B3:
  - notificaciones/consumers.py  (MapaConsumer, NotifConsumer — auth y conexión WS)
  - notificaciones/tasks.py      (recalc_urgency_score — lógica de recálculo)
"""
from datetime import timedelta
from django.utils import timezone
from unittest.mock import patch

from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.gis.geos import Point
from django.core.cache import cache
from django.test import TestCase, TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from bd.models import Animal, Incidencia, PerfilRescatista, Usuario
from notificaciones.routing import websocket_urlpatterns
from notificaciones.tasks import calcular_trafico, recalc_urgency_score

# Usamos InMemoryChannelLayer para no depender de Redis en los tests
CHANNEL_LAYERS_TEST = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

application = URLRouter(websocket_urlpatterns)


# ---------------------------------------------------------------------------
# MapaConsumer
# ---------------------------------------------------------------------------

@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
class MapaConsumerTests(TestCase):

    def test_conexion_anonima_con_zona_ok(self):
        """Cualquier cliente puede conectar a ws/mapa/ sin token."""
        async def inner():
            communicator = WebsocketCommunicator(application, "/ws/mapa/?zona=19.43_-99.13")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
        async_to_sync(inner)()

    def test_conexion_sin_zona_usa_default(self):
        """Si no se pasa ?zona= el consumer usa 'default' y conecta igual."""
        async def inner():
            communicator = WebsocketCommunicator(application, "/ws/mapa/")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
        async_to_sync(inner)()

    def test_reenvio_evento_new_report(self):
        """El consumer reenvía al cliente el evento new_report recibido del channel layer."""
        async def inner():
            from channels.layers import get_channel_layer
            communicator = WebsocketCommunicator(application, "/ws/mapa/?zona=test_zona")
            connected, _ = await communicator.connect()
            self.assertTrue(connected)

            layer = get_channel_layer()
            await layer.group_send("mapa_test_zona", {
                "type": "new_report",
                "tipo": "new_report",
                "id": 1,
                "lat": 19.43,
                "lng": -99.13,
                "urgency_score": 35.0,
                "estado": "PENDIENTE",
            })

            mensaje = await communicator.receive_json_from(timeout=2)
            self.assertEqual(mensaje["tipo"], "new_report")
            self.assertEqual(mensaje["id"], 1)
            self.assertNotIn("type", mensaje)  # la clave interna de channels no llega al cliente
            await communicator.disconnect()
        async_to_sync(inner)()

    def test_reenvio_evento_urgency_update(self):
        """El consumer reenvía urgency_update al cliente correctamente."""
        async def inner():
            from channels.layers import get_channel_layer
            communicator = WebsocketCommunicator(application, "/ws/mapa/?zona=zona_urgencia")
            await communicator.connect()

            layer = get_channel_layer()
            await layer.group_send("mapa_zona_urgencia", {
                "type": "urgency_update",
                "tipo": "urgency_update",
                "id": 7,
                "urgency_score": 82.0,
            })

            mensaje = await communicator.receive_json_from(timeout=2)
            self.assertEqual(mensaje["tipo"], "urgency_update")
            self.assertEqual(mensaje["urgency_score"], 82.0)
            await communicator.disconnect()
        async_to_sync(inner)()


# ---------------------------------------------------------------------------
# NotifConsumer
# ---------------------------------------------------------------------------

@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
class NotifConsumerTests(TransactionTestCase):
    # TransactionTestCase, no TestCase: WebsocketCommunicator corre el
    # consumer en otro hilo/conexión. Con TestCase (transacción compartida
    # entre hilos) el primer test deja la conexión de BD cerrada y todos los
    # siguientes truenan en setUp() con "connection already closed".
    def setUp(self):
        self.usuario = Usuario.objects.create_user(
            email='notif@test.com', password='Test1234!', roles=['RESCATISTA']
        )
        refresh = RefreshToken.for_user(self.usuario)
        self.token_valido = str(refresh.access_token)

    def test_conexion_con_token_valido_ok(self):
        """JWT válido y uid coincidente → conexión aceptada."""
        async def inner():
            url = f"/ws/notif/{self.usuario.id}/?token={self.token_valido}"
            communicator = WebsocketCommunicator(application, url)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
        async_to_sync(inner)()

    def test_token_invalido_cierra_con_4001(self):
        """Token basura → consumer acepta y cierra con código 4001."""
        async def inner():
            url = f"/ws/notif/{self.usuario.id}/?token=esto-no-es-un-jwt"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            close_msg = await communicator.receive_output(timeout=2)
            self.assertEqual(close_msg["type"], "websocket.close")
            self.assertEqual(close_msg["code"], 4001)
        async_to_sync(inner)()

    def test_sin_token_cierra_con_4001(self):
        """Sin query param token → cierra con 4001."""
        async def inner():
            url = f"/ws/notif/{self.usuario.id}/"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            close_msg = await communicator.receive_output(timeout=2)
            self.assertEqual(close_msg["type"], "websocket.close")
            self.assertEqual(close_msg["code"], 4001)
        async_to_sync(inner)()

    def test_uid_diferente_al_token_cierra_con_4003(self):
        """Token válido pero uid de URL no coincide → cierra con 4003."""
        async def inner():
            uid_ajeno = self.usuario.id + 999
            url = f"/ws/notif/{uid_ajeno}/?token={self.token_valido}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            close_msg = await communicator.receive_output(timeout=2)
            self.assertEqual(close_msg["type"], "websocket.close")
            self.assertEqual(close_msg["code"], 4003)
        async_to_sync(inner)()

    def test_reenvio_urgency_alert(self):
        """El consumer reenvía urgency_alert recibido del channel layer."""
        async def inner():
            from channels.layers import get_channel_layer
            url = f"/ws/notif/{self.usuario.id}/?token={self.token_valido}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()

            layer = get_channel_layer()
            await layer.group_send(f"notif_{self.usuario.id}", {
                "type": "urgency_alert",
                "tipo": "urgency_alert",
                "reporte_id": 5,
                "urgency_score": 85.0,
                "tipo_animal": "perro",
            })

            mensaje = await communicator.receive_json_from(timeout=2)
            self.assertEqual(mensaje["tipo"], "urgency_alert")
            self.assertEqual(mensaje["reporte_id"], 5)
            await communicator.disconnect()
        async_to_sync(inner)()


# ---------------------------------------------------------------------------
# recalc_urgency_score — lógica de la tarea Celery
# ---------------------------------------------------------------------------

@override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
class RecalcUrgencyScoreTests(TestCase):
    def setUp(self):
        self.animal_critico = Animal.objects.create(nombre='Test', tipo='perro', salud='critico')
        self.animal_estable = Animal.objects.create(nombre='Stable', tipo='gato', salud='estable')
        self.incidencia = Incidencia.objects.create(
            animal=self.animal_critico,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE',
            urgency_score=0.0,
        )

    def tearDown(self):
        cache.clear()

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_score_se_actualiza_cuando_delta_es_mayor_3(self, mock_broadcast):
        """Con animal critico y recien creado: score = 100*0.55 + 0*0.45 = 55 → delta=55 ≥ 3 → actualiza y notifica."""
        recalc_urgency_score()
        self.incidencia.refresh_from_db()
        self.assertAlmostEqual(self.incidencia.urgency_score, 55.0, delta=0.1)
        mock_broadcast.assert_called_once()

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_score_no_se_actualiza_cuando_delta_es_menor_3(self, mock_broadcast):
        """Si el score calculado esta a menos de 3 puntos del actual, no hay actualizacion."""
        # Con critico y recien creado: score nuevo ≈ 55. Pre-cargamos 54 → delta ≈ 1 < 3
        Incidencia.objects.filter(pk=self.incidencia.pk).update(urgency_score=54.0)
        recalc_urgency_score()
        mock_broadcast.assert_not_called()

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_trafico_score_ya_no_afecta_el_calculo(self, mock_broadcast):
        """trafico_score se saco de la formula: dos incidencias identicas salvo por
        trafico_score deben terminar con el mismo urgency_score."""
        self.incidencia.trafico_score = 100
        self.incidencia.save(update_fields=['trafico_score'])
        recalc_urgency_score()
        self.incidencia.refresh_from_db()
        self.assertAlmostEqual(self.incidencia.urgency_score, 55.0, delta=0.1)

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_trust_score_bajo_limita_el_score_a_79(self, mock_broadcast):
        """Con trust_score < 40 el score queda topado en 79 aunque condicion+tiempo den mas."""
        Incidencia.objects.filter(pk=self.incidencia.pk).update(
            trust_score=20,
            created_at=timezone.now() - timedelta(hours=70),  # tiempo saturado -> score crudo = 100
        )
        recalc_urgency_score()
        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.urgency_score, 79)

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_incidencia_cerrada_no_se_recalcula(self, mock_broadcast):
        """Las incidencias en estado CERRADO quedan fuera del queryset."""
        Incidencia.objects.filter(pk=self.incidencia.pk).update(estado='CERRADO')
        recalc_urgency_score()
        mock_broadcast.assert_not_called()

    @patch('notificaciones.tasks.notify_user')
    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_urgency_alert_enviado_cuando_score_supera_80(self, mock_broadcast, mock_notify):
        """Cuando el nuevo score ≥ 80 se envía urgency_alert a todos los rescatistas."""
        rescatista = Usuario.objects.create_user(
            email='resc@test.com', password='Test!', roles=['RESCATISTA']
        )
        PerfilRescatista.objects.create(usuario=rescatista)

        # El score se fuerza por condición (ya es 'critico' desde setUp) y tiempo
        # — trafico_score ya no pesa en la fórmula.
        # tiempo satura a 100 desde ~66.7h -> score = 100*0.55 + 100*0.45 = 100 (techo)
        # created_at va por update(): auto_now_add ignora los save() normales.
        Incidencia.objects.filter(pk=self.incidencia.pk).update(
            created_at=timezone.now() - timedelta(hours=70)
        )

        recalc_urgency_score()

        mock_broadcast.assert_called_once()
        mock_notify.assert_called_once_with(rescatista.id, {
            "type": "urgency_alert",
            "tipo": "urgency_alert",
            "reporte_id": self.incidencia.id,
            "distancia_km": None,
            "urgency_score": 100.0,
            "tipo_animal": "perro",
        })

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_multiples_incidencias_solo_actualiza_con_delta_suficiente(self, mock_broadcast):
        """Dos incidencias: una con delta ≥ 3 y otra sin cambio → solo una llamada a broadcast."""
        # Segunda incidencia con score ya cercano al calculado (δ pequeño esperado)
        Incidencia.objects.create(
            animal=self.animal_estable,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE',
            urgency_score=8.5,  # Con estable: score nuevo ≈ 20*0.55 = 11 → delta ≈ 2.5 < 3
        )
        recalc_urgency_score()
        # Solo la primera incidencia (critico, delta=55) debe haber llamado broadcast
        self.assertEqual(mock_broadcast.call_count, 1)


# ---------------------------------------------------------------------------
# calcular_trafico — consulta a Overpass
# ---------------------------------------------------------------------------

class CalcularTraficoTests(TestCase):
    def setUp(self):
        animal = Animal.objects.create(nombre='Trafico', tipo='perro', salud='estable')
        self.incidencia = Incidencia.objects.create(
            animal=animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE',
        )

    @patch('notificaciones.tasks.requests.post')
    def test_envia_user_agent_para_evitar_406(self, mock_post):
        """Overpass devuelve 406 sin User-Agent; la tarea debe mandarlo siempre."""
        mock_post.return_value.raise_for_status.return_value = None
        mock_post.return_value.json.return_value = {"elements": []}

        calcular_trafico(self.incidencia.pk)

        _, kwargs = mock_post.call_args
        self.assertIn('User-Agent', kwargs.get('headers', {}))

    @patch('notificaciones.tasks.requests.post')
    def test_guarda_score_de_la_via_mas_peligrosa(self, mock_post):
        """Con varias vias cercanas, gana la de mayor score (motorway=100 sobre tertiary=40)."""
        mock_post.return_value.raise_for_status.return_value = None
        mock_post.return_value.json.return_value = {
            "elements": [
                {"tags": {"highway": "tertiary"}},
                {"tags": {"highway": "motorway"}},
            ]
        }

        calcular_trafico(self.incidencia.pk)

        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.trafico_score, 100)

    @patch('notificaciones.tasks.requests.post')
    def test_falla_de_overpass_no_rompe_la_tarea(self, mock_post):
        """Si Overpass falla (timeout, 406, etc.) la tarea no debe propagar la excepcion."""
        mock_post.side_effect = Exception("406 Client Error")

        calcular_trafico(self.incidencia.pk)  # no debe lanzar

        self.incidencia.refresh_from_db()
        self.assertEqual(self.incidencia.trafico_score, 0)

    def test_incidencia_inexistente_no_rompe_la_tarea(self):
        calcular_trafico(999999)  # no debe lanzar
