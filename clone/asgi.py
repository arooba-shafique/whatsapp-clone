import os
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
import whatsapp.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'clone.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(
            whatsapp.routing.websocket_urlpatterns
        )
    ),
})
