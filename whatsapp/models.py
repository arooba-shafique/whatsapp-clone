from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType


class User(AbstractUser):
    phone_number = models.CharField(max_length=15, unique=True)
    profile_picture = models.ImageField(upload_to='profiles/', blank=True, null=True)
    about = models.CharField(max_length=255, default="Hey there! I am using WhatsApp.")
    last_seen = models.DateTimeField(default=timezone.now)
    is_online = models.BooleanField(default=False)

    REQUIRED_FIELDS = ['email']
    USERNAME_FIELD = 'username'

    def __str__(self):
        return self.username


class ChatMessage(models.Model):
    STATUS_CHOICES = [
        ('sent', 'Sent'),
        ('delivered', 'Delivered'),
        ('seen', 'Seen'),
    ]

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='sent_messages', on_delete=models.CASCADE)
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='received_messages', on_delete=models.CASCADE)
    message = models.TextField(blank=True)
    file = models.FileField(upload_to='chat_files/', blank=True, null=True)
    message_type = models.CharField(max_length=10, choices=[
        ('text', 'Text'), ('image', 'Image'), ('video', 'Video'), ('audio', 'Audio'), ('file', 'File')
    ], default='text')
    timestamp = models.DateTimeField(auto_now_add=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='sent')
    is_seen = models.BooleanField(default=False)
    is_starred = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='starred_direct_messages', blank=True)

    edited = models.BooleanField(default=False)
    deleted_for = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name='deleted_messages')
    is_deleted = models.BooleanField(default=False)

    is_forwarded = models.BooleanField(default=False)
    forwarded_chat = models.ForeignKey(
        'self', on_delete=models.SET_NULL, null=True, blank=True, related_name='forwards_from_chat'
    )
    forwarded_group_message = models.ForeignKey(
        'GroupMessage', on_delete=models.SET_NULL, null=True, blank=True, related_name='forwards_from_group'
    )

    def __str__(self):
        return f"{self.sender} → {self.receiver}: {self.message[:20]}"


class ChatGroup(models.Model):
    name = models.CharField(max_length=100)
    icon = models.ImageField(upload_to='group_icons/', blank=True, null=True)
    admin = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='admin_groups', on_delete=models.CASCADE)
    members = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='group_members')
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.admin and self.admin not in self.members.all():
            self.members.add(self.admin)

    def __str__(self):
        return self.name


class GroupMessage(models.Model):
    MESSAGE_TYPES = [
        ('text', 'Text'), ('image', 'Image'), ('video', 'Video'), ('audio', 'Audio'), ('file', 'File'),
    ]

    group = models.ForeignKey(ChatGroup, related_name='messages', on_delete=models.CASCADE)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.TextField(blank=True)
    file = models.FileField(upload_to='group_chat_files/', blank=True, null=True)
    message_type = models.CharField(max_length=10, choices=MESSAGE_TYPES, default='text')
    timestamp = models.DateTimeField(auto_now_add=True)

    seen_by = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='seen_group_messages', blank=True)
    is_starred = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='starred_group_messages', blank=True)
    deleted_for = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='deleted_group_messages', blank=True)
    deleted_for_everyone = models.BooleanField(default=False)
    is_forwarded = models.BooleanField(default=False)

    def emoji_summary(self):
        from collections import Counter
        emojis = self.reactions.values_list('emoji', flat=True)
        return dict(Counter(emojis))

    def __str__(self):
        return f"{self.group.name} - {self.sender.username}: {self.message[:20]}"


class GroupMessageReaction(models.Model):
    message = models.ForeignKey(GroupMessage, related_name='reactions', on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=5)

    class Meta:
        unique_together = ('message', 'user')

    def __str__(self):
        return f"{self.user} reacted {self.emoji} to GroupMessage {self.message.id}"


class GroupMessageForward(models.Model):
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    original_message = GenericForeignKey('content_type', 'object_id')

    forwarded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    forwarded_to_group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE)
    forwarded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        if self.original_message:
            return f"{self.forwarded_by} forwarded message {self.original_message.id} (Type: {self.content_type.model}) to {self.forwarded_to_group.name}"
        return f"{self.forwarded_by} forwarded a message to {self.forwarded_to_group.name}"


class Status(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    image = models.ImageField(upload_to='status_images/')
    caption = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    viewers = models.ManyToManyField(settings.AUTH_USER_MODEL, related_name='viewed_status', blank=True)

    def __str__(self):
        return f"{self.user.username}'s status"

    def is_active(self):
        return timezone.now() - self.created_at < timezone.timedelta(hours=24)


class BlockedUser(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_users')
    blocked = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='blocked_by_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blocked')

    def __str__(self):
        return f"{self.user.username} blocked {self.blocked.username}"


class Contact(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='contacts', on_delete=models.CASCADE)
    contact = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='in_contacts', on_delete=models.CASCADE)

    class Meta:
        unique_together = ('owner', 'contact')

    def __str__(self):
        return f"{self.owner} has {self.contact}"


class MessageReaction(models.Model):
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    emoji = models.CharField(max_length=5)

    class Meta:
        unique_together = ('message', 'user')

    def __str__(self):
        return f"{self.user} reacted {self.emoji} to message {self.message.id}"


class StarredMessage(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    message = models.ForeignKey(ChatMessage, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'message')


class ChatView(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    other_user = models.ForeignKey(settings.AUTH_USER_MODEL, related_name='chat_views', on_delete=models.CASCADE)
    last_opened = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'other_user')


class GroupChatView(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    group = models.ForeignKey(ChatGroup, on_delete=models.CASCADE)
    last_opened = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'group')


class GroupMessageReadReceipt(models.Model):
    message = models.ForeignKey('GroupMessage', on_delete=models.CASCADE, related_name='read_receipts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_message_reads')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')
        ordering = ['timestamp']

    def __str__(self):
        return f"{self.user.username} read GroupMessage {self.message.id} in {self.message.group.name}"
