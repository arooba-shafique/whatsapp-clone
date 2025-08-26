from django.urls import path
from . import views

urlpatterns = [
    # Landing & Auth
    path('', views.landing_page, name='landing'),
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    # Profile
    path('profile/', views.profile_sidebar, name='profile_sidebar'),
    path('profile/edit/', views.edit_profile, name='edit_profile'),
    path('profile/<int:user_id>/', views.view_profile, name='view_profile'),
    path('remove-contact/<int:user_id>/', views.remove_contact, name='remove_contact'),


    # Chat
    path('chat/', views.chat_home, name='chat_home'),
    path('chat/<int:user_id>/', views.chat_detail, name='chat_detail'),
    path('check-new-messages/', views.check_new_messages, name='check_new_messages'),
    path('delete-message/<int:message_id>/me/', views.delete_for_me, name='delete_for_me'),
    path('delete-message/<int:message_id>/everyone/', views.delete_for_everyone, name='delete_for_everyone'),
    path('toggle-star/', views.toggle_starred_message, name='toggle_starred_message'),
    path('starred/', views.starred_messages, name='starred_messages'),
    path('react/', views.toggle_reaction, name='toggle_reaction'),
    path('send-reaction/', views.send_reaction, name='send_reaction'),
    path('add-reaction/', views.add_reaction, name='add_reaction'),
    path('mark_seen/<int:user_id>/', views.mark_seen, name='mark_seen'),
    path('mark_delivered/<int:user_id>/', views.mark_delivered, name='mark_delivered'),
    path('get-message-details/<str:message_type>/<int:message_id>/', views.get_message_details, name='get_message_details'),
    path('upload_group_file/', views.upload_group_file, name='upload_group_file'),


    # **NEW FORWARDING URLS**
    path('forward/user/', views.forward_to_user, name='forward_to_user'),
    path('forward/group/', views.forward_to_group, name='forward_to_group'),

    # Groups
    path('groups/', views.group_list, name='group_list'),
    path('groups/create/', views.create_group, name='create_group'),
    path('groups/<int:group_id>/', views.group_chat_detail, name='group_chat_detail'),
    path('group/<int:group_id>/profile/', views.group_profile, name='group_profile'),
    path('group/<int:group_id>/update-icon/', views.update_group_icon, name='update_group_icon'),
    path('group-react/', views.toggle_group_reaction, name='toggle_group_reaction'),
    path('chat/group/<int:group_id>/message/<int:message_id>/delete/', views.delete_group_message, name='delete_group_message'),
    path('group/<int:group_id>/message/<int:message_id>/react/', views.group_message_react, name='group_message_react'),
    path('toggle-star-group/', views.toggle_starred_group_message, name='toggle_starred_group_message'),
    path("star-message/", views.star_message, name="star_message"),
    path("star-group-message/", views.star_group_message, name="star_group_message"),
    path('group/<int:group_id>/edit/', views.edit_group, name='edit_group'),

    # Status
    path('status/', views.status_view, name='status_view'),
    path('status/view/<int:status_id>/', views.view_single_status, name='view_single_status'),
    path('my-status/', views.my_status_view, name='my_status_view'),
    path('status/upload/', views.status_upload, name='status_upload'),

    # Settings
    path('settings/chats/', views.chat_settings, name='chat_settings'),
    path('settings/notifications/', views.notification_settings, name='notification_settings'),
    path('settings/help/', views.help_center, name='help_center'),
    path('settings/storage/', views.storage_settings, name='storage_settings'),
    path('settings/terms/', views.terms_of_service, name='terms_of_service'),

    # Contacts
    path('contacts/add/', views.add_contact, name='add_contact'),
    path('settings/privacy/', views.privacy_policy, name='privacy_policy'),

    # Block
    path('block/', views.block_user, name='block_user'),
]