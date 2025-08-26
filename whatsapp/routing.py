# whatsapp/routing.py
from django.urls import re_path
from . import consumers # Make sure this import is correct

websocket_urlpatterns = [
    # NEW: Group Chat Consumer (only this one now)
    # The <group_id> will be used to identify the specific chat group
    re_path(r'ws/chat/group/(?P<group_id>\d+)/$', consumers.ChatConsumer.as_asgi()),
]