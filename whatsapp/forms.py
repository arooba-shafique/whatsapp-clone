from django import forms
from django.contrib.auth.forms import UserCreationForm, AuthenticationForm
from django.contrib.auth import get_user_model
from .models import (
    ChatMessage, ChatGroup, GroupMessage, Status,
    Contact, BlockedUser, MessageReaction, GroupMessageReaction
)

User = get_user_model()


class UserRegisterForm(UserCreationForm):
    phone_number = forms.CharField(max_length=15, required=True)
    profile_picture = forms.ImageField(required=False)
    about = forms.CharField(max_length=255, required=False)

    class Meta(UserCreationForm.Meta):
        model = User
        fields = ['username', 'email', 'phone_number', 'profile_picture', 'about']


class UserLoginForm(AuthenticationForm):
    username = forms.CharField(label="Username")


class ChatMessageForm(forms.ModelForm):
    class Meta:
        model = ChatMessage
        fields = ['message', 'file', 'message_type']
        widgets = {
            'message': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Type a message...'}),
        }


class ChatGroupForm(forms.ModelForm):
    members = forms.ModelMultipleChoiceField(
        queryset=User.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=True
    )

    class Meta:
        model = ChatGroup
        fields = ['name', 'icon', 'admin', 'members']


class GroupMessageForm(forms.ModelForm):
    class Meta:
        model = GroupMessage
        fields = ['message', 'file', 'message_type']
        widgets = {
            'message': forms.Textarea(attrs={'rows': 2, 'placeholder': 'Send to group...'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['message'].required = False
        self.fields['file'].required = False

    def clean(self):
        cleaned_data = super().clean()
        message = cleaned_data.get('message')
        file = cleaned_data.get('file')
        message_type = cleaned_data.get('message_type')

        if message_type in ['image', 'video', 'audio', 'file']:
            if not file:
                self.add_error('file', "Media messages of this type require a file to be attached.")
        elif message_type == 'text':
            if not message and not file:
                self.add_error('message', "Text messages cannot be empty.")

        if not message and not file and not message_type:
            raise forms.ValidationError("Cannot send an empty message. Please provide text or attach a file.")

        return cleaned_data


class StatusForm(forms.ModelForm):
    class Meta:
        model = Status
        fields = ['image', 'caption']


class ContactForm(forms.ModelForm):
    class Meta:
        model = Contact
        fields = ['contact']


class BlockedUserForm(forms.ModelForm):
    blocked = forms.ModelChoiceField(queryset=User.objects.all(), label="User to Block")

    class Meta:
        model = BlockedUser
        fields = ['blocked']


class MessageReactionForm(forms.ModelForm):
    class Meta:
        model = MessageReaction
        fields = ['message', 'emoji']


class UserProfileUpdateForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ['username', 'email', 'phone_number', 'profile_picture', 'about']


class GroupMessageReactionForm(forms.ModelForm):
    class Meta:
        model = GroupMessageReaction
        fields = ['message', 'emoji']


class GroupEditForm(forms.ModelForm):
    class Meta:
        model = ChatGroup
        fields = ['name']
