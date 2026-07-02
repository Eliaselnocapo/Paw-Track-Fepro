"""
Tests para RescateConsumer:
  - rescates/consumers.py  (auth JWT, autorización por rol, reenvío de eventos)
"""
from asgiref.sync import async_to_sync
from channels.routing import URLRouter
from channels.testing import WebsocketCommunicator
from django.contrib.gis.geos import Point
from django.test import TransactionTestCase, override_settings
from rest_framework_simplejwt.tokens import RefreshToken

from bd.models import Animal, Incidencia, PerfilRescatista, Usuario
from rescates.models import Rescate
from rescates.routing import websocket_urlpatterns

CHANNEL_LAYERS_TEST = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

application = URLRouter(websocket_urlpatterns)


class RescateConsumerTests(TransactionTestCase):
    def setUp(self):
        self.reportero = Usuario.objects.create_user(
            email="reportero@test.com", password="Test1234!", roles=["REPORTERO"]
        )
        self.rescatista = Usuario.objects.create_user(
            email="rescatista@test.com", password="Test1234!", roles=["RESCATISTA"]
        )
        self.ajeno = Usuario.objects.create_user(
            email="ajeno@test.com", password="Test1234!", roles=["REPORTERO"]
        )

        self.animal = Animal.objects.create(nombre="Rex", tipo="perro", salud="herido")
        self.incidencia = Incidencia.objects.create(
            animal=self.animal,
            ubicacion=Point(-99.1332, 19.4326, srid=4326),
            tipo_incidencia="EMERGENCIA",
            estado="ATENDIENDOSE",
            usuario_reporta=self.reportero,
        )
        self.rescate = Rescate.objects.create(
            incidencia=self.incidencia,
            rescatista=self.rescatista,
            estado="EN_CAMINO",
        )

        self.token_reportero = str(RefreshToken.for_user(self.reportero).access_token)
        self.token_rescatista = str(RefreshToken.for_user(self.rescatista).access_token)
        self.token_ajeno = str(RefreshToken.for_user(self.ajeno).access_token)

    # ------------------------------------------------------------------
    # Conexión — casos de acceso
    # ------------------------------------------------------------------

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_reportero_puede_conectar(self):
        """El reportero de la incidencia puede conectar al canal del rescate."""
        async def inner():
            url = f"/ws/rescate/{self.rescate.id}/?token={self.token_reportero}"
            communicator = WebsocketCommunicator(application, url)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_rescatista_asignado_puede_conectar(self):
        """El rescatista asignado al rescate puede conectar al canal."""
        async def inner():
            url = f"/ws/rescate/{self.rescate.id}/?token={self.token_rescatista}"
            communicator = WebsocketCommunicator(application, url)
            connected, _ = await communicator.connect()
            self.assertTrue(connected)
            await communicator.disconnect()
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_usuario_ajeno_cierra_con_4003(self):
        """Un usuario que no es reportero ni rescatista asignado recibe 4003."""
        async def inner():
            url = f"/ws/rescate/{self.rescate.id}/?token={self.token_ajeno}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            msg = await communicator.receive_output(timeout=2)
            self.assertEqual(msg["type"], "websocket.close")
            self.assertEqual(msg["code"], 4003)
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_token_invalido_cierra_con_4001(self):
        """Token basura cierra la conexión con 4001."""
        async def inner():
            url = f"/ws/rescate/{self.rescate.id}/?token=esto-no-es-jwt"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            msg = await communicator.receive_output(timeout=2)
            self.assertEqual(msg["type"], "websocket.close")
            self.assertEqual(msg["code"], 4001)
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_sin_token_cierra_con_4001(self):
        """Sin query param token cierra con 4001."""
        async def inner():
            url = f"/ws/rescate/{self.rescate.id}/"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            msg = await communicator.receive_output(timeout=2)
            self.assertEqual(msg["type"], "websocket.close")
            self.assertEqual(msg["code"], 4001)
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_rescate_inexistente_cierra_con_4004(self):
        """Si el rescate_id no existe en DB cierra con 4004."""
        async def inner():
            url = f"/ws/rescate/99999/?token={self.token_rescatista}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()
            msg = await communicator.receive_output(timeout=2)
            self.assertEqual(msg["type"], "websocket.close")
            self.assertEqual(msg["code"], 4004)
        async_to_sync(inner)()

    # ------------------------------------------------------------------
    # Reenvío de eventos
    # ------------------------------------------------------------------

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_reenvio_estado_actualizado(self):
        """El consumer reenvía estado_actualizado al cliente correctamente."""
        async def inner():
            from channels.layers import get_channel_layer
            url = f"/ws/rescate/{self.rescate.id}/?token={self.token_rescatista}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()

            layer = get_channel_layer()
            await layer.group_send(f"rescate_{self.rescate.id}", {
                "type": "estado_actualizado",
                "tipo": "estado_actualizado",
                "rescate_id": self.rescate.id,
                "estado": "COMPLETADO",
            })

            msg = await communicator.receive_json_from(timeout=2)
            self.assertEqual(msg["tipo"], "estado_actualizado")
            self.assertEqual(msg["estado"], "COMPLETADO")
            self.assertNotIn("type", msg)
            await communicator.disconnect()
        async_to_sync(inner)()

    @override_settings(CHANNEL_LAYERS=CHANNEL_LAYERS_TEST)
    def test_reenvio_ubicacion_rescatista(self):
        """El consumer reenvía ubicacion_rescatista al reportero correctamente."""
        async def inner():
            from channels.layers import get_channel_layer
            url = f"/ws/rescate/{self.rescate.id}/?token={self.token_reportero}"
            communicator = WebsocketCommunicator(application, url)
            await communicator.connect()

            layer = get_channel_layer()
            await layer.group_send(f"rescate_{self.rescate.id}", {
                "type": "ubicacion_rescatista",
                "tipo": "ubicacion_rescatista",
                "lat": 19.4350,
                "lng": -99.1300,
            })

            msg = await communicator.receive_json_from(timeout=2)
            self.assertEqual(msg["tipo"], "ubicacion_rescatista")
            self.assertEqual(msg["lat"], 19.4350)
            self.assertNotIn("type", msg)
            await communicator.disconnect()
        async_to_sync(inner)()
