import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pawtrack.settings")

# get_asgi_application() inicializa el app registry de Django.
# Las importaciones de routing deben ir DESPUÉS de esta llamada.
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from notificaciones.routing import websocket_urlpatterns as notif_patterns
from rescates.routing import websocket_urlpatterns as rescate_patterns

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": URLRouter(notif_patterns + rescate_patterns),
})
