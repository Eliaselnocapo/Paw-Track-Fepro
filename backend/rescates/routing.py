from django.urls import re_path

from . import consumers

websocket_urlpatterns = [
    re_path(r"^ws/rescate/(?P<rescate_id>\d+)/$", consumers.RescateConsumer.as_asgi()),
]
