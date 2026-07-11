"""
Tests para B3:
  - notificaciones/consumers.py  (MapaConsumer, NotifConsumer — auth y conexión WS)
  - notificaciones/tasks.py      (recalc_urgency_score — lógica de recálculo)
"""
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
from notificaciones.tasks import recalc_urgency_score

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
    def test_score_se_actualiza_cuando_delta_es_mayor_10(self, mock_broadcast):
        """Con animal critico el score sube de 0 a ~40 → delta=40 ≥ 10 → actualiza y notifica."""
        recalc_urgency_score()
        self.incidencia.refresh_from_db()
        self.assertGreater(self.incidencia.urgency_score, 0)
        mock_broadcast.assert_called_once()

    @patch('notificaciones.tasks.broadcast_urgency_update')
    def test_score_no_se_actualiza_cuando_delta_es_menor_10(self, mock_broadcast):
        """Si el score calculado está a menos de 10 puntos del actual, no hay actualización."""
        # Con critico y recién creado: score nuevo ≈ 40. Pre-cargamos 36 → delta ≈ 4 < 10
        Incidencia.objects.filter(pk=self.incidencia.pk).update(urgency_score=36.0)
        recalc_urgency_score()
        mock_broadcast.assert_not_called()

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

        # Forzar score alto via caché de clima y tráfico con valores altos
        # score = 40 + 0 + 200*0.15 + 200*0.15 = 40 + 30 + 30 = 100 (techo) → delta=100 ≥ 10
        cache.set(f"clima_{self.incidencia.id}", 200)
        cache.set(f"trafico_{self.incidencia.id}", 200)

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
        """Dos incidencias: una con delta ≥ 10 y otra sin cambio → solo una llamada a broadcast."""
        # Segunda incidencia con score ya alto (δ pequeño esperado)
        Incidencia.objects.create(
            animal=self.animal_estable,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia='EMERGENCIA',
            estado='PENDIENTE',
            urgency_score=8.5,  # Con estable: score nuevo ≈ 8.0 → delta ≈ 0.5 < 10
        )
        recalc_urgency_score()
        # Solo la primera incidencia (critico, delta=40) debe haber llamado broadcast
        self.assertEqual(mock_broadcast.call_count, 1)
