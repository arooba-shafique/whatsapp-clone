from django.contrib import admin
from .models import (
    User,
    ChatMessage,
    ChatGroup,
    GroupMessage,
    GroupMessageReaction,
    Status,
    BlockedUser,
    Contact,
    MessageReaction,
    StarredMessage,
)

admin.site.register(User)
admin.site.register(ChatMessage)
admin.site.register(ChatGroup)
admin.site.register(GroupMessage)
admin.site.register(GroupMessageReaction)
admin.site.register(Status)
admin.site.register(BlockedUser)
admin.site.register(Contact)
admin.site.register(MessageReaction)
admin.site.register(StarredMessage)
