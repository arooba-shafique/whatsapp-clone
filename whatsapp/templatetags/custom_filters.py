import os
from django import template

register = template.Library()

# Existing filters
@register.filter
def basename(value):
    return os.path.basename(str(value)) # Ensure value is treated as string for os.path.basename

@register.filter
def dict_get(dictionary, key):
    return dictionary.get(key, 0)

@register.filter
def get_item(dictionary, key):
    if isinstance(dictionary, dict):
        return dictionary.get(key)
    return None

# NEW FILTERS FOR REACTIONS
@register.filter
def get_unique_emojis(reactions_queryset):
    """
    Returns a sorted list of unique emoji characters from a queryset of reactions.
    """
    if reactions_queryset:
        # Use values_list to get a list of emoji characters, then set for uniqueness,
        # then list and sort for consistent order.
        unique_emojis = sorted(list(set(reactions_queryset.values_list('emoji', flat=True))))
        return unique_emojis
    return [] # Return an empty list if no reactions

@register.filter
def filter_by_emoji(reactions_queryset, emoji_char):
    """
    Filters a queryset of reactions to include only those with a specific emoji character.
    """
    return reactions_queryset.filter(emoji=emoji_char)

@register.filter
def count_emoji(reactions_queryset, emoji_char):
    """
    Counts the number of reactions for a specific emoji character within a queryset.
    """
    return reactions_queryset.filter(emoji=emoji_char).count()

from whatsapp.models import Contact  # Add this at the top if not already

@register.filter
def is_contact(user, other_user):
    """
    Checks if other_user is in the contact list of user.
    """
    return Contact.objects.filter(owner=user, contact=other_user).exists()
