from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.db.models import Q, Max, F, Count 
from django.utils import timezone 
from django.db import transaction 
from datetime import datetime 
from django.views.decorators.csrf import csrf_exempt
import json
import os
from mimetypes import guess_type
from django.contrib.auth import get_user_model
User = get_user_model()
from .forms import *
from .models import *
from django.views.decorators.http import require_POST
from django.http import JsonResponse, HttpResponseBadRequest
from .forms import ChatGroupForm as GroupForm
from .models import ChatGroup as Group
from datetime import timedelta
from django.template.loader import render_to_string
from django.core.files.base import ContentFile
import shutil
import traceback
from django.contrib.contenttypes.models import ContentType
import requests
from urllib.parse import urlparse
from django.utils.timezone import make_aware
from django.http import HttpResponseForbidden
User = get_user_model()

def view_function(request):
    if not request.user.is_authenticated:
        return HttpResponseForbidden("Access denied.")


def copy_message_file(original_file_field, destination_path_prefix):
    if original_file_field and original_file_field.name:
        original_path = original_file_field.path
        if os.path.exists(original_path):
            file_extension = os.path.splitext(original_file_field.name)[1]
            new_filename = f"forwarded_{timezone.now().strftime('%Y%m%d%H%M%S%f')}{file_extension}"
            new_file_path = os.path.join(settings.MEDIA_ROOT, destination_path_prefix, new_filename)
            os.makedirs(os.path.dirname(new_file_path), exist_ok=True)
            shutil.copyfile(original_path, new_file_path)
            return os.path.join(destination_path_prefix, new_filename)
    return None


def register_view(request):
    if request.method == 'POST':
        form = UserRegisterForm(request.POST, request.FILES)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('chat_home')
    else:
        form = UserRegisterForm()
    return render(request, 'auth/register.html', {'form': form})

def login_view(request):
    if request.method == 'POST':
        form = UserLoginForm(request, data=request.POST)
        if form.is_valid():
            user = form.get_user()
            login(request, user)
            return redirect('chat_home')
    else:
        form = UserLoginForm()
    return render(request, 'auth/login.html', {'form': form})

def logout_view(request):
    logout(request)
    return redirect('login')


@login_required
def chat_home(request):
    current_user = request.user
    blocked_ids = BlockedUser.objects.filter(user=current_user).values_list('blocked_id', flat=True)

    contact_ids = Contact.objects.filter(
        owner=current_user
        ).exclude(contact_id__in=blocked_ids).values_list('contact_id', flat=True)

    chat_user_ids = ChatMessage.objects.filter(
        Q(sender=current_user) | Q(receiver=current_user)
        ).values_list('sender', 'receiver')

    chat_user_ids = set(uid for pair in chat_user_ids for uid in pair if uid != current_user.id and uid not in blocked_ids)

    all_user_ids = set(contact_ids) | set(chat_user_ids)

    all_other_users = User.objects.filter(id__in=all_user_ids)

    direct_chats_data = []
    for user in all_other_users:
        last_message = ChatMessage.objects.filter(
            (Q(sender=current_user, receiver=user) |
             Q(sender=user, receiver=current_user))
        ).exclude(deleted_for=current_user).order_by('-timestamp').first()

        unread_count = 0
        if last_message: 
            try:
                last_view = ChatView.objects.get(user=current_user, other_user=user).last_opened
                unread_count = ChatMessage.objects.filter(
                    sender=user,
                    receiver=current_user,
                    timestamp__gt=last_view,
                    is_seen=False
                ).count()
            except ChatView.DoesNotExist:
                unread_count = ChatMessage.objects.filter(
                    sender=user,
                    receiver=current_user,
                    is_seen=False
                ).count()
        elif not last_message:
             unread_count = ChatMessage.objects.filter(
                sender=user,
                receiver=current_user,
                is_seen=False
             ).count()


        direct_chats_data.append({
            'user_obj': user,
            'last_message': last_message,
            'unread_count': unread_count,
            'last_activity_time': last_message.timestamp if last_message else make_aware(datetime.min)
        })

    direct_chats_data.sort(key=lambda x: x['last_activity_time'], reverse=True)

    groups = ChatGroup.objects.filter(members=current_user)

    group_chats_data = []
    for group in groups:
        last_group_message = GroupMessage.objects.filter(
            group=group
        ).exclude(deleted_for=current_user).order_by('-timestamp').first()
        group_unread_count = 0
        if last_group_message:
            try:
                last_view = GroupChatView.objects.get(user=current_user, group=group).last_opened
                group_unread_count = GroupMessage.objects.filter(
                    group=group,
                    timestamp__gt=last_view
                ).exclude(sender=current_user).exclude(seen_by=current_user).count()
            except GroupChatView.DoesNotExist:
                group_unread_count = GroupMessage.objects.filter(
                    group=group
                ).exclude(sender=current_user).exclude(seen_by=current_user).count()


        group_chats_data.append({
            'group_obj': group,
            'last_message': last_group_message,
            'unread_count': group_unread_count,
            'last_activity_time': last_group_message.timestamp if last_group_message else make_aware(datetime.min)
        })

    group_chats_data.sort(key=lambda x: x['last_activity_time'], reverse=True)

    combined_chats_data = sorted(
        direct_chats_data + group_chats_data,
        key=lambda x: x['last_activity_time'],
        reverse=True
    )


    return render(request, 'chat/home.html', {
        'direct_chats_data': direct_chats_data, 
        'group_chats_data': group_chats_data,   
        'combined_chats_data': combined_chats_data, 
 
    })



def safe_ts(obj):
    return obj.timestamp if obj and obj.timestamp else make_aware(datetime.min)


@login_required
def chat_detail(request, user_id):

    receiver = get_object_or_404(User, id=user_id)
    is_contact = Contact.objects.filter(owner=request.user, contact=receiver).exists()
    has_existing_chat = ChatMessage.objects.filter(
        Q(sender=request.user, receiver=receiver) |
        Q(sender=receiver, receiver=request.user)
        ).exists()
    if not is_contact and not has_existing_chat:
        return HttpResponseForbidden("You are not allowed to chat with this user.")

    groups = Group.objects.filter(members=request.user)
    last_group_messages = {}
    for group in groups:
        last_msg = GroupMessage.objects.filter(
            group=group
        ).exclude(deleted_for=request.user).order_by('-timestamp').first()
        last_group_messages[group.id] = last_msg

    groups = sorted(groups, key=lambda g: safe_ts(last_group_messages[g.id]), reverse=True)

    contact_user_ids = Contact.objects.filter(owner=request.user).values_list('contact_id', flat=True)
    users = User.objects.filter(id__in=contact_user_ids)

    last_messages = {}
    for user in users:
        last_msg = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=user) |
            Q(sender=user, receiver=request.user)
        ).exclude(deleted_for=request.user).order_by('-timestamp').first()
        last_messages[user.id] = last_msg

    users = sorted(users, key=lambda u: safe_ts(last_messages[u.id]), reverse=True)
    
    emoji_reactions = ['😊', '😂', '❤️', '👍', '😢', '😮', '😡', '👏', '🎉', '💯']

    messages_qs = ChatMessage.objects.filter(
        Q(sender=request.user, receiver=receiver) |
        Q(sender=receiver, receiver=request.user)
    ).exclude(
        deleted_for=request.user
    ).order_by('timestamp')

    ChatMessage.objects.filter(
        sender=receiver,
        receiver=request.user,
        status__in=['sent', 'delivered']
    ).update(status='seen', is_seen=True)

    ChatView.objects.update_or_create(
        user=request.user,
        other_user=receiver,
        defaults={'last_opened': timezone.now()}
    )

    starred_msg_ids = StarredMessage.objects.filter(user=request.user).values_list('message_id', flat=True)

    first_unread_msg = messages_qs.filter(
        receiver=request.user,
        status__in=['sent', 'delivered'],
        is_deleted=False
    ).order_by('timestamp').first()

    first_unread_msg_id = first_unread_msg.id if first_unread_msg else None


    if request.method == 'POST':
        form = ChatMessageForm(request.POST, request.FILES)
        if form.is_valid():
            msg = form.save(commit=False)
            msg.sender = request.user
            msg.receiver = receiver
            msg.status = 'sent'
            msg.save()
            message_data = {
                'id': msg.id,
                'sender_id': msg.sender.id,
                'receiver_id': msg.receiver.id,
                'message': msg.message,
                'timestamp': msg.timestamp.strftime("%Y-%m-%dT%H:%M:%S"), 
                'is_read': msg.is_seen,
                'file_url': msg.file.url if msg.file else None,
                'file_name': msg.file.name.split('/')[-1] if msg.file else None,
                'message_type': msg.message_type,
                'sender_username': msg.sender.username,
                'receiver_username': msg.receiver.username,
            }
            if msg.timestamp:
                message_data['formatted_timestamp'] = msg.timestamp.strftime("%I:%M %p")

            return JsonResponse({
                'status': 'success',
                'message': 'Message sent successfully!',
                'message_data': message_data,
            })
        else:
            print("Chat Message Form errors:", form.errors)
            return JsonResponse({'status': 'error', 'errors': form.errors.as_json()}, status=400) 
    else:
        form = ChatMessageForm()
    
    combined_chats = get_combined_chats(request.user)
    

    return render(request, 'chat/chat_detail.html', {
        'receiver': receiver,
        'messages': messages_qs,
        'form': form, 
        'users': users,
        'groups': groups,
        'emoji_reactions': emoji_reactions,
        'first_unread_msg_id': first_unread_msg_id,
        'last_messages': last_messages,
        'last_group_messages': last_group_messages,
        'combined_chats': combined_chats, 
        "starred_msg_ids": list(starred_msg_ids),
    })



@login_required
def group_chat_detail(request, group_id):
    group = get_object_or_404(ChatGroup, id=group_id)

    if request.user not in group.members.all():
        return redirect('chat_home')
    messages_qs = GroupMessage.objects.filter(
    group=group,
    deleted_for_everyone=False
).exclude(
    deleted_for=request.user
).order_by('timestamp')

    emoji_reactions = ['😊', '😂', '❤️', '👍', '😢', '😮', '😡', '👏', '🎉', '💯']
    starred_msg_ids = GroupMessage.objects.filter(
        group=group,
        is_starred=request.user
        ).values_list('id', flat=True)


    groups = ChatGroup.objects.filter(members=request.user)
    last_group_messages = {}
    for g in groups:
        last_msg = GroupMessage.objects.filter(
            group=g
        ).exclude(deleted_for=request.user).order_by('-timestamp').first()
        last_group_messages[g.id] = last_msg
    for msg in messages_qs:
        if request.user not in msg.seen_by.all():
            msg.seen_by.add(request.user)

    

    groups = sorted(groups, key=lambda g: safe_ts(last_group_messages.get(g.id)), reverse=True)
    GroupChatView.objects.update_or_create(
        user=request.user,
        group=group,
        defaults={'last_opened': timezone.now()}
        )

    users = User.objects.filter(in_contacts__owner=request.user)
    last_messages = {}
    for user in users:
        last_msg = ChatMessage.objects.filter(
            Q(sender=request.user, receiver=user) |
            Q(sender=user, receiver=request.user)
        ).exclude(deleted_for=request.user).order_by('-timestamp').first()
        last_messages[user.id] = last_msg

    users = sorted(users, key=lambda u: safe_ts(last_messages.get(u.id)), reverse=True)


    if request.method == 'POST':
        form = GroupMessageForm(request.POST, request.FILES)
        if form.is_valid():
            msg = form.save(commit=False)
            msg.sender = request.user
            msg.group = group
            msg.save()
            return redirect('group_chat_detail', group_id=group.id)
        else:
            print("Form errors:", form.errors)

    else:
        
        form = GroupMessageForm()
    combined_chats = get_combined_chats(request.user)

    return render(request, 'groups/group_detail.html', {
        'is_group': True,
        'group': group,
        'messages': messages_qs,
        'form': form,
        'users': users,
        'groups': groups,
        'emoji_reactions': emoji_reactions,
        'last_messages': last_messages,
        'last_group_messages': last_group_messages,
        'combined_chats': combined_chats, 
        'starred_msg_ids': starred_msg_ids,
    })



@login_required
def group_list(request):
    groups = ChatGroup.objects.filter(members=request.user)
    return render(request, 'group_list.html', {'groups': groups})


def group_profile(request, group_id):
    group = get_object_or_404(ChatGroup, id=group_id)
    return render(request, 'groups/group_profile.html', {'group': group})


@csrf_exempt
@require_POST
@login_required
def mark_seen(request, user_id):
    if request.user.is_authenticated:
        updated = ChatMessage.objects.filter(
            sender_id=user_id,
            receiver=request.user,
            status__in=['sent', 'delivered']
        ).update(status='seen', is_seen=True)

        return JsonResponse({'status': 'ok', 'updated': updated})
    return JsonResponse({'error': 'unauthorized'}, status=403)

@csrf_exempt
@require_POST
@login_required
def mark_delivered(request, user_id):
    if request.user.is_authenticated:
        updated = ChatMessage.objects.filter(
            sender_id=user_id,
            receiver=request.user,
            status='sent'
        ).update(status='delivered')
        return JsonResponse({'status': 'ok', 'updated': updated})
    return JsonResponse({'error': 'unauthorized'}, status=403)

@login_required
def status_upload(request):
    if request.method == 'POST':
        form = StatusForm(request.POST, request.FILES)
        if form.is_valid():
            status = form.save(commit=False)
            status.user = request.user
            status.save()
            return redirect('status_view')
    else:
        form = StatusForm()
    return render(request, 'status/status_upload.html', {'form': form})

@login_required
def status_view(request):
    active_statuses = Status.objects.filter(created_at__gte=timezone.now()-timedelta(hours=24)).exclude(user=request.user)
    my_statuses = Status.objects.filter(user=request.user, created_at__gte=timezone.now()-timedelta(hours=24))
    return render(request, 'status/status_view.html', {
        'statuses': active_statuses,
        'my_statuses': my_statuses
    })


@login_required
def view_single_status(request, status_id):
    status = get_object_or_404(Status, id=status_id)
    if request.user != status.user and request.user not in status.viewers.all():
        status.viewers.add(request.user)
    return render(request, 'status/status_detail.html', {'status': status})


@login_required
def my_status_view(request):
    time_threshold = timezone.now() - timedelta(hours=24)
    
    my_statuses = Status.objects.filter(
        user=request.user,
        created_at__gte=time_threshold
    ).order_by('-created_at')

    return render(request, 'status/my_status.html', {'statuses': my_statuses})


@login_required
def add_contact(request):
    if request.method == 'POST':
        form = ContactForm(request.POST)
        if form.is_valid():
            contact = form.save(commit=False)
            contact.owner = request.user
            contact.save()
            return redirect('chat_home')
    else:
        form = ContactForm()
    return render(request, 'contacts/add_contact.html', {'form': form})


@login_required
def block_user(request):
    if request.method == 'POST':
        form = BlockedUserForm(request.POST) 
        if form.is_valid():
            blocked = form.save(commit=False)
            blocked.user = request.user
            blocked.save()
            return redirect('chat_home')
    else:
        form = BlockedUserForm()
    return render(request, 'contacts/block_user.html', {'form': form})

@login_required
def edit_profile(request):
    if request.method == 'POST':
        form = UserProfileUpdateForm(request.POST, request.FILES, instance=request.user)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated successfully!")
            return redirect('chat_home')
    else:
        form = UserProfileUpdateForm(instance=request.user)
    return render(request, 'auth/edit_profile.html', {'form': form})


@login_required
def profile_sidebar(request):
    if request.method == 'POST':
        user = request.user
        user.username = request.POST.get('username', user.username)
        user.about = request.POST.get('about', user.about)
        if 'profile_picture' in request.FILES:
            user.profile_picture = request.FILES['profile_picture']
        user.save()
        return redirect('profile_sidebar')
    return render(request, 'profile/profile_sidebar.html', {'user': request.user})



@login_required
def check_new_messages(request):
    new_messages = ChatMessage.objects.filter(receiver=request.user, status__in=["sent", "delivered"]).count()
    return JsonResponse({"new_messages": new_messages})



@login_required
def chat_settings(request):
    return render(request, 'settings/chats.html')


@login_required
def notification_settings(request):
    return render(request, 'settings/notifications.html')



@login_required
def help_center(request):
    return render(request, 'settings/help.html')

def landing_page(request):
    if request.user.is_authenticated:
        return redirect('chat_home')
    return render(request, 'landing.html', {'year': timezone.now().year})


@login_required
def toggle_starred_message(request):
    if request.method == 'POST':
        msg_id = request.POST.get('message_id')
        if not msg_id:
            return JsonResponse({'success': False, 'error': 'No message ID provided'})

        try:
            msg = ChatMessage.objects.get(id=msg_id)

            starred, created = StarredMessage.objects.get_or_create(user=request.user, message=msg)
            if not created:
                starred.delete()
                return JsonResponse({'success': True, 'is_starred': False})
            else:
                return JsonResponse({'success': True, 'is_starred': True})
        except ChatMessage.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Message not found'})

    return HttpResponseBadRequest('Invalid request')



@csrf_exempt
@login_required
def toggle_reaction(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message_id = data.get("message_id")
            emoji = data.get("emoji")

            msg = ChatMessage.objects.get(id=message_id)

            reaction, created = MessageReaction.objects.get_or_create(
                user=request.user, message=msg
            )

            if not created and reaction.emoji == emoji:
                reaction.delete()
            else:
                reaction.emoji = emoji
                reaction.save()

            reactions = MessageReaction.objects.filter(message=msg)
            reactions_data = [
                {"user": r.user.username, "emoji": r.emoji}
                for r in reactions
            ]

            return JsonResponse({"success": True, "reactions": reactions_data})
        except ChatMessage.DoesNotExist:
            return JsonResponse({"success": False, "error": "Message not found"})
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)})

    return JsonResponse({"success": False, "error": "Invalid request method"})

@csrf_exempt
@login_required
def send_reaction(request):
    if request.method == "POST":
        data = json.loads(request.body)
        message_id = data.get("message_id")
        emoji = data.get("emoji")

        message = ChatMessage.objects.get(id=message_id)
        reaction, created = MessageReaction.objects.update_or_create(
            user=request.user,
            message=message,
            defaults={"emoji": emoji}
        )

        all_reactions = MessageReaction.objects.filter(message=message)
        reaction_data = [{"emoji": r.emoji, "user": r.user.username} for r in all_reactions]

        return JsonResponse({"success": True, "reactions": reaction_data})
    return JsonResponse({"success": False}, status=400)


@csrf_exempt
@login_required
def add_reaction(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        emoji = data.get("emoji")
        msg_id = data.get("message_id")

        try:
            msg = ChatMessage.objects.get(id=msg_id)
            reaction, created = MessageReaction.objects.update_or_create(
                user=request.user,
                message=msg,
                defaults={"emoji": emoji}
            )
            reactions_html = render_to_string("chat/_reactions.html", {"message": msg})
            return JsonResponse({"success": True, "reactions_html": reactions_html})
        except ChatMessage.DoesNotExist:
            return JsonResponse({"success": False, "error": "Message not found"})

    return JsonResponse({"success": False, "error": "Invalid method"})

@login_required
@require_POST 
def delete_for_me(request, message_id):
    msg = get_object_or_404(ChatMessage, id=message_id)

    if (
        msg.sender == request.user or 
        msg.receiver == request.user or 
        (msg.group and request.user in msg.group.members.all())
    ):
        msg.deleted_for.add(request.user)
        return JsonResponse({'success': True, 'message': 'Message deleted for you.'})
    
    return JsonResponse({'success': False, 'error': 'Not authorized to delete this message.'}, status=403)



@login_required
@require_POST
def delete_for_everyone(request, message_id):
    msg = get_object_or_404(ChatMessage, id=message_id)

    if msg.is_deleted:
        return JsonResponse({'success': False, 'error': 'Message already deleted for everyone.'}, status=400)

    if msg.sender == request.user:
        msg.message = ""
        msg.is_deleted = True
        msg.save()
        return JsonResponse({'success': True, 'message': 'Message deleted for everyone.'})
    
    return JsonResponse({'success': False, 'error': 'You can only delete your own messages for everyone.'}, status=403)


@login_required
def starred_messages(request):
    direct_starred = ChatMessage.objects.filter(
        id__in=StarredMessage.objects.filter(user=request.user).values_list('message_id', flat=True)
    )

    group_starred = GroupMessage.objects.filter(is_starred=request.user)

    context = {
        'direct_starred': direct_starred,
        'group_starred': group_starred,
    }
    return render(request, 'starred_messages.html', context)



@login_required
def view_profile(request, user_id):
    other_user = get_object_or_404(User, id=user_id)
    return render(request, 'profile/view_profile.html', {'other_user': other_user})



@login_required
def create_group(request):
    if request.method == 'POST':
        form = GroupForm(request.POST, request.FILES)
        if form.is_valid():
            group = form.save(commit=False)
            group.save()
            members = form.cleaned_data['members']
            for member in members:
                group.members.add(member)
            group.members.add(request.user)

            return redirect('chat_home')
    else:
        form = GroupForm()

    return render(request, 'groups/create_group.html', {'form': form})



@csrf_exempt 
def toggle_group_reaction(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message_id = data.get("message_id")
            emoji = data.get("emoji")

            if not message_id or not emoji:
                return JsonResponse({"success": False, "error": "Missing message_id or emoji"}, status=400)

            msg = get_object_or_404(GroupMessage, id=message_id) 
            try:
                reaction = GroupMessageReaction.objects.get(user=request.user, message=msg)
                if reaction.emoji == emoji:
                    reaction.delete()
                    action = "removed"
                else:
                    reaction.emoji = emoji
                    reaction.save()
                    action = "updated"
            except GroupMessageReaction.DoesNotExist:
                GroupMessageReaction.objects.create(user=request.user, message=msg, emoji=emoji)
                action = "added"
            reactions_html = render_to_string(
                "chat/reactions.html", 
                {"message": msg, 'is_group': True},
                request=request 
            )

            return JsonResponse({"success": True, "action": action, "reactions_html": reactions_html})

        except GroupMessage.DoesNotExist:
            return JsonResponse({"success": False, "error": "Group message not found."}, status=404) 
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "error": "Invalid JSON format."}, status=400)
        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=500)
    return JsonResponse({"success": False, "error": "Invalid request method."}, status=405)


@login_required
def update_group_icon(request, group_id):
    group = get_object_or_404(ChatGroup, id=group_id)

    if request.user != group.admin:
        messages.error(request, "Only the group admin can update the icon.")
        return redirect('group_profile', group_id=group.id)

    if request.method == 'POST' and 'icon' in request.FILES:
        group.icon = request.FILES['icon']
        group.save()
        messages.success(request, "Group icon updated successfully.")

    return redirect('group_profile', group_id=group.id)

@login_required
@require_POST
@csrf_exempt 
def delete_group_message(request, group_id, message_id): 
    try:
        data = json.loads(request.body)
        delete_type = data.get('delete_type') 

        message = get_object_or_404(GroupMessage, id=message_id, group_id=group_id)

        if request.user not in message.group.members.all():
            return JsonResponse({'status': 'error', 'message': 'You are not a member of this group.'}, status=403)

        if delete_type == 'for_me': 
           
            if request.user not in message.deleted_for.all():
                message.deleted_for.add(request.user)
            return JsonResponse({'status': 'success', 'message': 'Message deleted for you.'})

        elif delete_type == 'for_everyone': 
            if message.sender != request.user:
                return JsonResponse({'status': 'error', 'message': 'You can only delete your own messages for everyone.'}, status=403)

            message.deleted_for_everyone = True
            message.message = ''  
            message.file = None   
            message.is_forwarded = False 
            message.save()

            return JsonResponse({
                'status': 'success',
                'message': 'Message deleted for everyone.',
                'message_id': message.id,
                'sender_username': message.sender.username, 
                'timestamp': message.timestamp.strftime("%I:%M %p") 
            })
        else:
            return JsonResponse({'status': 'error', 'message': 'Invalid delete type provided.'}, status=400)

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON format.'}, status=400)
    except GroupMessage.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Message not found.'}, status=404)
    except Exception as e:
        import traceback
        traceback.print_exc() 
        return JsonResponse({'status': 'error', 'message': f'An unexpected error occurred: {str(e)}'}, status=500)



def mark_group_message_delivered(request, group_id):
    return JsonResponse({'status': 'delivered'})


def storage_settings(request):
    return render(request, 'chat/storage_settings.html')



def terms_of_service(request):
    return render(request, 'settings/terms.html')




def contact_support(request):
    if request.method == 'POST':
        name = request.POST.get('name')
        issue = request.POST.get('issue')


        messages.success(request, "Your issue is submitted.")
        return redirect('contact_support')  

    return render(request, 'settings/support.html')  



@login_required
def blocked_contacts(request):
    return render(request, 'settings/blocked_contacts.html') 




def safe_ts(obj):
    return obj.timestamp if obj and obj.timestamp else make_aware(datetime.min)

def get_combined_chats(user):
    groups = Group.objects.filter(members=user)
    last_group_messages = {}
    group_data = []
    
    for group in groups:
        last_msg = GroupMessage.objects.filter(
            group=group
        ).exclude(deleted_for=user).order_by('-timestamp').first()
        last_group_messages[group.id] = last_msg

        unread_count = 0
        if last_msg:
            try:
                last_view = GroupChatView.objects.get(user=user, group=group).last_opened
                unread_count = GroupMessage.objects.filter(
                    group=group,
                    timestamp__gt=last_view
                ).exclude(sender=user).exclude(seen_by=user).count()
            except GroupChatView.DoesNotExist:
                unread_count = GroupMessage.objects.filter(
                    group=group
                ).exclude(sender=user).exclude(seen_by=user).count()

        group_data.append({
            'type': 'group',
            'participant': group,
            'last_message': last_msg,
            'timestamp': safe_ts(last_msg),
            'unread_count': unread_count
        })

    blocked_ids = BlockedUser.objects.filter(user=user).values_list('blocked_id', flat=True)
    contacts = Contact.objects.filter(owner=user).exclude(contact_id__in=blocked_ids).values_list('contact', flat=True)
    users = User.objects.filter(id__in=contacts)

    last_messages = {}
    user_data = []
    
    for u in users:
        last_msg = ChatMessage.objects.filter(
            Q(sender=user, receiver=u) | Q(sender=u, receiver=user)
        ).exclude(deleted_for=user).order_by('-timestamp').first()
        last_messages[u.id] = last_msg

        unread_count = 0
        if last_msg:
            try:
                last_view = ChatView.objects.get(user=user, other_user=u).last_opened
                unread_count = ChatMessage.objects.filter(
                    sender=u,
                    receiver=user,
                    timestamp__gt=last_view,
                    is_seen=False
                ).count()
            except ChatView.DoesNotExist:
                unread_count = ChatMessage.objects.filter(
                    sender=u,
                    receiver=user,
                    is_seen=False
                ).count()
        else:
            unread_count = ChatMessage.objects.filter(
                sender=u,
                receiver=user,
                is_seen=False
            ).count()

        user_data.append({
            'type': 'direct',
            'participant': u,
            'last_message': last_msg,
            'timestamp': safe_ts(last_msg),
            'unread_count': unread_count
        })


    combined_chats = user_data + group_data
    combined_chats.sort(key=lambda x: x['timestamp'], reverse=True)

    return combined_chats


@login_required
@require_POST
def toggle_starred_group_message(request):
    msg_id = request.POST.get('message_id')

    if not msg_id:
        return JsonResponse({'success': False, 'error': 'No message ID provided'})

    try:
        msg = GroupMessage.objects.get(id=msg_id)

        if request.user in msg.is_starred.all():
            msg.is_starred.remove(request.user)
            return JsonResponse({'success': True, 'is_starred': False})
        else:
            msg.is_starred.add(request.user)
            return JsonResponse({'success': True, 'is_starred': True})

    except GroupMessage.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Group message not found'})



def render_reactions_html(message, is_group, request):
    return render_to_string('chat/reactions.html', {'message': message, 'is_group': is_group}, request=request)


@login_required
@require_POST
def group_message_react(request, group_id, message_id):
    try:
        data = json.loads(request.body)
        emoji = data.get('emoji')

        if not emoji:
            return JsonResponse({'success': False, 'error': 'Missing emoji.'}, status=400)
        message = get_object_or_404(GroupMessage, id=message_id, group__id=group_id)

        reaction, created = GroupMessageReaction.objects.get_or_create(
            message=message,
            user=request.user,
            defaults={'emoji': emoji}
        )

        if not created and reaction.emoji == emoji:
            reaction.delete()
            action = 'removed'
        elif not created:
            reaction.emoji = emoji
            reaction.save()
            action = 'updated'
        else:
            
            action = 'added'

        reactions_html = render_reactions_html(message, is_group=True, request=request)
        return JsonResponse({'success': True, 'action': action, 'reactions_html': reactions_html})

    except GroupMessage.DoesNotExist:
        return JsonResponse({'success': False, 'error': 'Group message not found or not in this group.'}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'Invalid JSON in request body.'}, status=400)
    except Exception as e:
        import traceback
        traceback.print_exc() 
        return JsonResponse({'success': False, 'error': f'An unexpected error occurred: {str(e)}'}, status=500)



@csrf_exempt
@login_required
def forward_to_user(request):
    if request.method == "POST":
        try:
            message_id = request.POST.get("message_id")
            target_user_id = request.POST.get("recipient_id")
            original_message_type = request.POST.get("original_message_type")

            if not message_id or not target_user_id or not original_message_type:
                return JsonResponse({"success": False, "error": "Missing message_id, target_user_id, or original_message_type"}, status=400)

            original_message = None
            if original_message_type == 'group':
                original_message = GroupMessage.objects.get(id=message_id)
                if request.user not in original_message.group.members.all():
                    return JsonResponse({'success': False, 'error': 'Permission denied to forward original group message'}, status=403)
            elif original_message_type == 'chat':
                original_message = ChatMessage.objects.get(id=message_id)
                if request.user != original_message.sender and request.user != original_message.receiver:
                    return JsonResponse({'success': False, 'error': 'Permission denied to forward original chat message'}, status=403)
            else:
                return JsonResponse({"success": False, "error": "Invalid original message type provided."}, status=400)

            target_user = User.objects.get(id=target_user_id)

            message_content = getattr(original_message, 'message', '')
            message_file_instance = getattr(original_message, 'file', None)
            message_type = getattr(original_message, 'message_type', 'text')

            forwarded_chat_instance = None
            forwarded_group_message_instance = None

            if original_message_type == 'chat':
                forwarded_chat_instance = original_message
            elif original_message_type == 'group':
                forwarded_group_message_instance = original_message

            new_chat_message = ChatMessage.objects.create(
                sender=request.user,
                receiver=target_user,
                message=message_content,
                message_type=message_type,
                is_forwarded=True,
                forwarded_chat=forwarded_chat_instance, 
                forwarded_group_message=forwarded_group_message_instance 
            )

            if message_file_instance and message_file_instance.name:
                try:
                    full_file_url = request.build_absolute_uri(message_file_instance.url)
                    response = requests.get(full_file_url, stream=True)
                    response.raise_for_status()

                    final_filename = os.path.basename(urlparse(message_file_instance.url).path)
                    new_chat_message.file.save(final_filename, ContentFile(response.content), save=True)

                except Exception as e:
                    print(f"DEBUG: Error downloading or saving forwarded file for chat message: {e}")
                    traceback.print_exc()
                    return JsonResponse({'success': False, 'error': f'Failed to process forwarded file: {e}'}, status=500)

            return JsonResponse({"success": True, "message": "Message forwarded to user."})

        except (ChatMessage.DoesNotExist, GroupMessage.DoesNotExist):
            return JsonResponse({"success": False, "error": "Original message not found."}, status=404)
        except User.DoesNotExist:
            return JsonResponse({"success": False, "error": "Target user not found."}, status=404)
        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"success": False, "error": f"An unexpected error occurred: {str(e)}"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method."}, status=405)


@csrf_exempt
@login_required
def forward_to_group(request):
    if request.method == "POST":
        try:
            message_id = request.POST.get("message_id")
            group_id = request.POST.get("group_id")
            original_message_type = request.POST.get("original_message_type")

            if not message_id or not group_id or not original_message_type:
                return JsonResponse({"success": False, "error": "Missing message_id, group_id, or original_message_type"}, status=400)

            original_message = None
            if original_message_type == 'group':
                original_message = GroupMessage.objects.get(id=message_id)
                if request.user not in original_message.group.members.all():
                    return JsonResponse({'success': False, 'error': 'Permission denied to forward original group message'}, status=403)
            elif original_message_type == 'chat':
                original_message = ChatMessage.objects.get(id=message_id)
                if request.user != original_message.sender and request.user != original_message.receiver:
                    return JsonResponse({'success': False, 'error': 'Permission denied to forward original chat message'}, status=403)
            else:
                return JsonResponse({"success": False, "error": "Invalid original message type provided."}, status=400)

            target_group = ChatGroup.objects.get(id=group_id)

            if request.user not in target_group.members.all():
                return JsonResponse({"success": False, "error": "You are not a member of the target group."}, status=403)

            message_content = getattr(original_message, 'message', '')
            message_file_instance = getattr(original_message, 'file', None)
            message_type = getattr(original_message, 'message_type', 'text')

            new_group_message = GroupMessage.objects.create(
                sender=request.user,
                group=target_group,
                message=message_content,
                message_type=message_type,
                is_forwarded=True, 
            )

            if message_file_instance and message_file_instance.name:
                try:
                    full_file_url = request.build_absolute_uri(message_file_instance.url)
                    response = requests.get(full_file_url, stream=True)
                    response.raise_for_status()

                    final_filename = os.path.basename(urlparse(message_file_instance.url).path)
                    new_group_message.file.save(final_filename, ContentFile(response.content), save=True)

                except Exception as e:
                    print(f"DEBUG: Error downloading or saving forwarded file for group message: {e}")
                    traceback.print_exc()
                    return JsonResponse({'success': False, 'error': f'Failed to process forwarded file: {e}'}, status=500)

            original_message_content_type = ContentType.objects.get_for_model(original_message)
            GroupMessageForward.objects.create(
                content_type=original_message_content_type,
                object_id=original_message.id,
                forwarded_by=request.user,
                forwarded_to_group=target_group
            )

            return JsonResponse({"success": True, "message": "Message forwarded to group."})

        except (ChatMessage.DoesNotExist, GroupMessage.DoesNotExist):
            return JsonResponse({"success": False, "error": "Original message not found."}, status=404)
        except ChatGroup.DoesNotExist:
            return JsonResponse({"success": False, "error": "Target group not found."}, status=404)
        except Exception as e:
            traceback.print_exc()
            return JsonResponse({"success": False, "error": f"An unexpected error occurred: {str(e)}"}, status=500)

    return JsonResponse({"success": False, "error": "Invalid request method."}, status=405)


@login_required
def get_message_details(request, message_type, message_id): 
    message = None
    is_group_message = False

    try:
        if message_type == 'chat':
            message = ChatMessage.objects.get(id=message_id)
            is_group_message = False
        elif message_type == 'group':
            message = GroupMessage.objects.get(id=message_id)
            is_group_message = True
        else:
            return JsonResponse({"success": False, "error": "Invalid message type provided in URL."}, status=400)

    except (ChatMessage.DoesNotExist, GroupMessage.DoesNotExist):
        return JsonResponse({'success': False, 'error': 'Message not found'}, status=404)

    if is_group_message:
        if request.user not in message.group.members.all():
            return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
    else: 
        if request.user != message.sender and request.user != message.receiver:
            return JsonResponse({'success': False, 'error': 'Permission denied'}, status=403)
  

    message_text = message.message if hasattr(message, 'message') else None
    file_url = None
    file_name = None
    message_actual_type = message.message_type if hasattr(message, 'message_type') else 'text'

    if message.file and message.file.name: 
        file_url = message.file.url
        file_name = os.path.basename(message.file.name) 

    sender_username = message.sender.username if message.sender else "Unknown"

    return JsonResponse({
        'success': True,
        'id': message.id,
        'message_text': message_text,
        'file_url': file_url,
        'file_name': file_name,
        'message_type': message_actual_type, 
        'sender_username': sender_username,
        'is_deleted': message.deleted_for_everyone if hasattr(message, 'deleted_for_everyone') else False or \
                      (request.user in message.deleted_for.all() if hasattr(message, 'deleted_for') else False)
    })

@csrf_exempt
@login_required
def star_message(request):
    if request.method == "POST":
        data = json.loads(request.body)
        msg = get_object_or_404(ChatMessage, id=data["message_id"])
        if request.user in msg.is_starred.all():
            msg.is_starred.remove(request.user)
            return JsonResponse({"status": "unstarred"})
        else:
            msg.is_starred.add(request.user)
            return JsonResponse({"status": "starred"})


@csrf_exempt
@login_required
def star_group_message(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            message_id = data.get("message_id")

            message = get_object_or_404(GroupMessage, id=message_id)

            if request.user in message.is_starred.all():
                message.is_starred.remove(request.user)
                return JsonResponse({"status": "unstarred"})
            else:
                message.is_starred.add(request.user)
                return JsonResponse({"status": "starred"})

        except (KeyError, json.JSONDecodeError):
            return JsonResponse({"error": "Invalid request"}, status=400)
    
    return JsonResponse({"error": "Invalid HTTP method"}, status=405)


@csrf_exempt
def upload_group_file(request):
    if request.method == 'POST':
        file = request.FILES.get('file')
        group_id = request.POST.get('group_id')
        message_text = request.POST.get('message', '')

        if not request.user.is_authenticated:
            return JsonResponse({'success': False, 'error': 'Authentication required'}, status=401)

        if not file:
            return JsonResponse({'success': False, 'error': 'No file provided'})

        try:
            group = ChatGroup.objects.get(id=group_id)
            sender = request.user 
        except ChatGroup.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Invalid group'}, status=400)

        mime_type, _ = guess_type(file.name)
        if mime_type and mime_type.startswith('image'):
            msg_type = 'image'
        elif mime_type and mime_type.startswith('video'):
            msg_type = 'video'
        else:
            msg_type = 'file'

        msg = GroupMessage.objects.create(
            group=group,
            sender=sender,
            file=file,
            message=message_text,
            message_type=msg_type,
            timestamp=timezone.now()
        )

        return JsonResponse({
            'success': True,
            'file_url': msg.file.url,
            'message_type': msg.message_type,
            'sender_id': msg.sender.id, 
            'message': message_text,
            'timestamp': msg.timestamp.strftime('%Y-%m-%d %H:%M:%S')
        })

    return JsonResponse({'success': False, 'error': 'Invalid request method'}, status=405) 


@login_required
def remove_contact(request, user_id):
    other_user = get_object_or_404(User, id=user_id)
    Contact.objects.filter(owner=request.user, contact=other_user).delete()
    return redirect('chat_home')  


def privacy_policy(request):
    return render(request, 'settings/privacy.html')


@login_required
def edit_group(request, group_id):
    group = get_object_or_404(ChatGroup, id=group_id)

    if request.user != group.admin:
        messages.warning(request, "Only group admins can edit the group.")
        return redirect('group_chat_detail', group_id=group.id)

    if request.method == 'POST':
        form = GroupEditForm(request.POST, instance=group)
        if form.is_valid():
            form.save()
            messages.success(request, "Group name updated successfully.")
            return redirect('group_chat_detail', group_id=group.id)
    else:
        form = GroupEditForm(instance=group)

    return render(request, 'edit_group.html', {'form': form, 'group': group})
