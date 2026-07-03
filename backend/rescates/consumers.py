from urllib.parse import parse_qs

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken


@sync_to_async
def _get_rescate(rescate_id):
    from rescates.models import Rescate
    try:
        return Rescate.objects.select_related(
            "incidencia", "rescatista"
        ).get(pk=rescate_id)
    except Rescate.DoesNotExist:
        return None


class RescateConsumer(AsyncJsonWebsocketConsumer):
    """ws/rescate/{rescate_id}/?token={jwt} — canal privado del rescate en curso.

    Acceso permitido solo al reportero de la incidencia y al rescatista asignado.
    Códigos de cierre:
      4001 — token inválido o ausente
      4002 — token expirado
      4003 — usuario no autorizado para este rescate
      4004 — rescate no encontrado
    """

    async def connect(self):
        self.rescate_id = self.scope["url_route"]["kwargs"]["rescate_id"]
        qs = parse_qs(self.scope["query_string"].decode())
        token_str = qs.get("token", [""])[0]

        # Validar JWT
        try:
            token = AccessToken(token_str)
        except TokenError as exc:
            await self.accept()
            code = 4002 if "expired" in str(exc).lower() else 4001
            await self.close(code=code)
            return

        user_id = str(token["user_id"])

        # Verificar que el rescate existe
        rescate = await _get_rescate(self.rescate_id)
        if rescate is None:
            await self.accept()
            await self.close(code=4004)
            return

        # Solo el reportero o el rescatista asignado pueden conectar
        es_reportero = str(rescate.incidencia.usuario_reporta_id) == user_id
        es_rescatista = str(rescate.rescatista_id) == user_id
        if not (es_reportero or es_rescatista):
            await self.accept()
            await self.close(code=4003)
            return

        self.group_name = f"rescate_{self.rescate_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def estado_actualizado(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})

    async def ubicacion_rescatista(self, event):
        await self.send_json({k: v for k, v in event.items() if k != "type"})
