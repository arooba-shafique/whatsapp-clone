import { globalData } from './globals.js';
import { getCookie } from './utils.js';
import { appendMessageToChatBox } from './utils.js';

export function scrollToBottom() {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

export function getLastMessageId() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return 0;
    const messages = chatBox.querySelectorAll('.chat-bubble[data-id]');
    if (messages.length > 0) {
        return parseInt(messages[messages.length - 1].dataset.id);
    }
    return 0;
}

export function checkNewMessages() {
    if (!globalData.checkNewMessagesUrl) {
        console.warn("checkNewMessagesUrl not found in globalData.");
        return;
    }

    let currentChatId = '';
    let isGroupChat = globalData.isGroup;

    if (globalData.isGroup && globalData.groupId) {
        currentChatId = globalData.groupId;
    } else if (!globalData.isGroup && globalData.receiverId) {
        currentChatId = globalData.receiverId;
    } else {
        console.warn("Current chat ID (group or receiver) not found in globalData.");
        return;
    }

    if (!currentChatId) {
        return;
    }

    fetch(globalData.checkNewMessagesUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            'chat_id': currentChatId,
            'is_group': isGroupChat,
            'last_message_id': getLastMessageId()
        })
    })
    .then(response => {
        if (!response.ok) {
            console.error('Network response was not ok:', response.statusText);
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        if (data.new_messages_html) {
            const chatBox = document.getElementById('chatBox');
            if (chatBox) {
                const atBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 1;
                chatBox.insertAdjacentHTML('beforeend', data.new_messages_html);
                if (atBottom) {
                    scrollToBottom();
                }
                if (window.setupEmojiReactions) window.setupEmojiReactions();
                if (window.setupModals) window.setupModals();
                if (window.setupForwardMessageLogic) window.setupForwardMessageLogic();
                if (window.setupStarToggleListeners) window.setupStarToggleListeners();
            }
            if (data.chat_notification_html) {
                const sidebarUserList = document.querySelector('.user-list');
                if (sidebarUserList) {
                    sidebarUserList.innerHTML = data.chat_notification_html;
                }
            }
            if (data.has_unseen_chats) {
                const chatNotificationDot = document.getElementById('chatNotificationDot');
                if (chatNotificationDot) {
                    chatNotificationDot.style.display = 'block';
                }
            } else {
                const chatNotificationDot = document.getElementById('chatNotificationDot');
                if (chatNotificationDot) {
                    chatNotificationDot.style.display = 'none';
                }
            }
        }
    })
    .catch(error => console.error('Error checking for new messages:', error));
}

setInterval(checkNewMessages, 3000);

document.addEventListener("DOMContentLoaded", function() {
    scrollToBottom();

    const messageForm = document.getElementById('messageForm');
    const messageInput = document.getElementById('messageInput');
    const fileInput = document.getElementById('fileInput');
    const messageTypeInput = document.getElementById('messageTypeInput');
    const messageSendButton = document.getElementById('messageSendButton');
    const chatBox = document.getElementById('chatBox');

    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                const selectedFile = this.files[0];
                if (selectedFile.type.startsWith('image/')) {
                    messageTypeInput.value = 'image';
                } else if (selectedFile.type.startsWith('video/')) {
                    messageTypeInput.value = 'video';
                } else {
                    messageTypeInput.value = 'file';
                }
                messageInput.placeholder = `File selected: ${selectedFile.name}`;
            } else {
                messageTypeInput.value = 'text';
                messageInput.placeholder = 'Type a message...';
            }
        });
    }

    if (messageForm) {
        messageForm.addEventListener('submit', async function(event) {
            event.preventDefault();

            const messageText = messageInput.value.trim();
            const selectedFile = fileInput.files[0];

            if (!messageText && !selectedFile) {
                alert('Please type a message or select a file to send.');
                return;
            }

            const formData = new FormData();
            formData.append('csrfmiddlewaretoken', getCookie('csrftoken'));
            
            if (messageText) {
                formData.append('message', messageText);
            }

            if (selectedFile) {
                formData.append('file', selectedFile);
                formData.append('message_type', messageTypeInput.value);
            } else {
                formData.append('message_type', 'text'); 
            }

            if (globalData.isGroup) {
                formData.append('group_id', globalData.groupId);
            } else {
                formData.append('receiver_id', globalData.receiverId);
            }

            messageSendButton.disabled = true;
            messageInput.disabled = true;
            fileInput.disabled = true;

            try {
                const url = globalData.isGroup
                    ? `/group/${globalData.groupId}/`
                    : `/chat/${globalData.receiverId}/`;

                const response = await fetch(url, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Server response not OK:', response.status, errorText);
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }

                const data = await response.json();

                if (data.status === 'success') {
                    if (chatBox) {
                        appendMessageToChatBox(data.message_data, chatBox, globalData.currentUserId, globalData.isGroup);
                        scrollToBottom();
                    }
                    messageInput.value = '';
                    fileInput.value = '';
                    messageTypeInput.value = 'text';
                    messageInput.placeholder = 'Type a message...';
                    checkNewMessages();
                } else {
                    console.error('Server reported an error:', data.message);
                    alert('Error: ' + data.message);
                }

            } catch (error) {
                console.error('Error sending message:', error);
                alert('Failed to send message. Please try again. Error: ' + error.message);
            } finally {
                messageSendButton.disabled = false;
                messageInput.disabled = false;
                fileInput.disabled = false;
            }
        });
    }
});
