# whatsapp/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from asgiref.sync import sync_to_async
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.db.models import Count

# Import your models from whatsapp/models.py
from .models import ChatGroup, GroupMessage # Assuming your models are here

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # The group_id will come from the URL, e.g., ws/chat/group/<group_id>/
        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.group_name = f'chat_group_{self.group_id}' # Unique name for this group's channel layer group
        self.user = self.scope['user'] # The authenticated user

        # 1. Authentication and Group Membership Check (Crucial for security)
        if not self.user.is_authenticated:
            print(f"User not authenticated, closing connection.")
            await self.close()
            return

        is_member = await self.check_group_membership(self.group_id, self.user)
        if not is_member:
            print(f"User {self.user.username} is not a member of group {self.group_id}, closing connection.")
            await self.close()
            return

        # 2. Join the Channel Layer Group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        await self.accept()
        print(f"User {self.user.username} connected to group {self.group_id}")

        # 3. Mark unseen messages as seen by the connecting user
        # This will trigger blue ticks for others who sent messages that this user hadn't seen yet.
        await self.mark_unseen_messages_as_seen(self.group_id, self.user)


    async def disconnect(self, close_code):
        print(f"User {self.user.username} disconnected from group {self.group_id} with code {close_code}")
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        print(f"Received message type: {message_type} from {self.user.username} in group {self.group_id}")

        if message_type == 'chat_message':
            # This is a new message being sent by the user
            content = data.get('content', '')
            file_url = data.get('file_url') # Expect a URL if it's a file
            message_content_type = data.get('message_type', 'text')

            if not content and not file_url:
                print("Empty message received, ignoring.")
                return

            # 1. Save the message to the database
            message_obj = await self.save_group_message(
                group_id=self.group_id,
                sender=self.user,
                content=content,
                message_type=message_content_type,
                file_url=file_url
            )
            print(f"Message {message_obj.id} saved by {self.user.username}.")

            # 2. Mark the sender as having seen their own message immediately
            await self.mark_message_as_seen_by_user(message_obj.id, self.user.id)
            print(f"Message {message_obj.id} marked as seen by sender {self.user.username}.")

            # 3. Prepare message data for broadcasting
            # Initial seen_by_count is 1 (the sender)
            total_members_count = await self.get_group_members_count(self.group_id)

            message_data = {
                'type': 'chat_message_broadcast', # This will call chat_message_broadcast method
                'message_id': message_obj.id,
                'sender_id': self.user.id,
                'sender_username': self.user.username,
                'content': content,
                'timestamp': message_obj.timestamp.isoformat(),
                'message_type': message_content_type,
                'file_url': file_url,
                'seen_by_count': 1, # Only sender has seen it so far
                'total_members_count': total_members_count,
            }

            # 4. Broadcast the message to all members in the group
            await self.channel_layer.group_send(
                self.group_name,
                message_data
            )
            print(f"Message {message_obj.id} broadcast to group {self.group_id}.")

        elif message_type == 'message_read':
            # This event comes from the client when a message is displayed on screen
            message_id = data.get('message_id')
            if message_id:
                # 1. Mark the message as seen by the current user
                is_updated = await self.mark_message_as_seen_by_user(message_id, self.user.id)

                if is_updated:
                    print(f"Message {message_id} marked as seen by {self.user.username}.")
                    # 2. Get updated seen status for the message
                    seen_by_count, total_members_count = await self.get_message_seen_status(message_id)

                    # 3. Notify all group members about the updated read status
                    await self.channel_layer.group_send(
                        self.group_name,
                        {
                            'type': 'message_status_update',
                            'message_id': message_id,
                            'reader_id': self.user.id,
                            'seen_by_count': seen_by_count,
                            'total_members_count': total_members_count,
                        }
                    )
                    print(f"Status update for message {message_id} broadcast to group {self.group_id}.")

    # Handlers for events sent to the group by channel_layer.group_send
    async def chat_message_broadcast(self, event):
        # This method receives 'chat_message_broadcast' events from the channel layer
        # and sends them to the connected client.
        # When a client receives this, it's considered "delivered" to that client.
        # Your frontend will interpret 'seen_by_count' and 'total_members_count' for ticks.
        await self.send(text_data=json.dumps({
            'type': 'chat_message', # Client-side will listen for this type
            'message_id': event['message_id'],
            'sender_id': event['sender_id'],
            'sender_username': event['sender_username'],
            'content': event['content'],
            'timestamp': event['timestamp'],
            'message_type': event['message_type'],
            'file_url': event['file_url'],
            'seen_by_count': event['seen_by_count'],
            'total_members_count': event['total_members_count'],
        }))

    async def message_status_update(self, event):
        # This method receives 'message_status_update' events from the channel layer
        # and sends them to the connected client.
        await self.send(text_data=json.dumps({
            'type': 'message_status_update',
            'message_id': event['message_id'],
            'reader_id': event['reader_id'],
            'seen_by_count': event['seen_by_count'],
            'total_members_count': event['total_members_count'],
        }))

    # --- Database Operations (must be synchronous using @sync_to_async) ---

    @sync_to_async
    def check_group_membership(self, group_id, user):
        try:
            group = ChatGroup.objects.get(id=group_id)
            return group.members.filter(id=user.id).exists()
        except ChatGroup.DoesNotExist:
            print(f"Error: ChatGroup with ID {group_id} not found.")
            return False

    @sync_to_async
    def save_group_message(self, group_id, sender, content, message_type, file_url):
        try:
            group = ChatGroup.objects.get(id=group_id)
            message = GroupMessage.objects.create(
                group=group,
                sender=sender,
                message=content,
                message_type=message_type,
                file=file_url if file_url else None
            )
            return message
        except ChatGroup.DoesNotExist:
            print(f"Error: ChatGroup with ID {group_id} not found when saving message.")
            raise # Re-raise to ensure it's handled upstream if necessary

    @sync_to_async
    def mark_message_as_seen_by_user(self, message_id, user_id):
        try:
            message = GroupMessage.objects.get(id=message_id)
            user = User.objects.get(id=user_id)
            if user not in message.seen_by.all():
                message.seen_by.add(user)
                return True # Indicates seen status changed
            return False # Already seen
        except (GroupMessage.DoesNotExist, User.DoesNotExist) as e:
            print(f"Error marking message as seen (Message ID: {message_id}, User ID: {user_id}): {e}")
            return False

    @sync_to_async
    def get_message_seen_status(self, message_id):
        """
        Returns the count of users who have seen a message and the total group members.
        """
        try:
            message = GroupMessage.objects.annotate(
                total_members=Count('group__members')
            ).get(id=message_id)

            seen_by_count = message.seen_by.count()
            total_members_count = message.total_members
            return seen_by_count, total_members_count
        except GroupMessage.DoesNotExist:
            print(f"Error: Message with ID {message_id} not found for seen status.")
            return 0, 0
        except Exception as e:
            print(f"Unexpected error getting message seen status for Message ID {message_id}: {e}")
            return 0, 0

    @sync_to_async
    def get_group_members_count(self, group_id):
        try:
            group = ChatGroup.objects.get(id=group_id)
            return group.members.count()
        except ChatGroup.DoesNotExist:
            print(f"Error: ChatGroup with ID {group_id} not found for member count.")
            return 0

    @sync_to_async
    def mark_unseen_messages_as_seen(self, group_id, user):
        """
        Marks all messages in a group that the specific user hasn't seen yet as seen.
        This is typically called when a user connects to the group chat.
        """
        try:
            group = ChatGroup.objects.get(id=group_id)
            # Find messages in this group not sent by the current user
            # and not yet seen by the current user
            unseen_messages_qs = GroupMessage.objects.filter(
                group=group
            ).exclude(
                sender=user
            ).exclude(
                seen_by=user
            )

            updated_message_ids = []
            for message in unseen_messages_qs: # Iterate through the queryset
                message.seen_by.add(user)
                updated_message_ids.append(message.id)

            # After marking, send status updates for these messages to the group
            for message_id in updated_message_ids:
                seen_by_count, total_members_count = self.get_message_seen_status(message_id)
                if total_members_count > 0:
                    self.channel_layer.group_send(
                        self.group_name,
                        {
                            'type': 'message_status_update',
                            'message_id': message_id,
                            'reader_id': user.id, # The user who just read it
                            'seen_by_count': seen_by_count,
                            'total_members_count': total_members_count,
                        }
                    )
            print(f"Marked {len(updated_message_ids)} unseen messages as seen for {user.username} in group {group_id}")

        except ChatGroup.DoesNotExist:
            print(f"Group {group_id} not found for marking unseen messages.")
        except Exception as e:
            print(f"Error marking unseen messages as seen: {e}")