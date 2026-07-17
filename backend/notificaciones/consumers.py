from urllib.parse import parse_qs

from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError


class MapaConsumer(AsyncJsonWebsocketConsumer):
    """ws/mapa/?zona={key} — anónimo, actualizaciones del mapa en tiempo real."""

    async def connect(self):
        qs = parse_qs(self.scope["query_string"].decode())
        self.zona_key = qs.get("zona", ["default"])[0]
        self.group_name = f"mapa_{self.zona_key}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def new_report(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})

    async def status_changed(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})

    async def urgency_update(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})


class NotifConsumer(AsyncJsonWebsocketConsumer):
    """ws/notif/{uid}/?token={jwt} — notificaciones personales, requiere JWT."""

    async def connect(self):
        self.uid = self.scope["url_route"]["kwargs"]["uid"]
        qs = parse_qs(self.scope["query_string"].decode())
        token_str = qs.get("token", [""])[0]

        try:
            token = AccessToken(token_str)
        except TokenError as exc:
            await self.accept()
            code = 4002 if "expired" in str(exc).lower() else 4001
            await self.close(code=code)
            return

        if str(token["user_id"]) != str(self.uid):
            await self.accept()
            await self.close(code=4003)
            return

        self.group_name = f"notif_{self.uid}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def urgency_alert(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})

    async def duplicate_detected(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})
