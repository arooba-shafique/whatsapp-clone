
let messageInput;
let messageSendButton;
let fileInput;
let messageTypeInput;
let groupId;
let userId;
let socket; 

document.addEventListener('DOMContentLoaded', () => {
    messageInput = document.getElementById('messageInput');
    messageSendButton = document.getElementById('messageSendButton');
    fileInput = document.getElementById('fileInput');
    messageTypeInput = document.getElementById('messageTypeInput');

    const groupIdScript = document.getElementById('groupId');
    const userIdScript = document.getElementById('userId');

    if (groupIdScript) {
        try {
            groupId = JSON.parse(groupIdScript.textContent);
        } catch (e) {
            console.error("Error parsing groupId:", e, "Content:", groupIdScript.textContent);
            groupId = null;
        }
    } else {
        console.error("groupId script tag not found!");
        groupId = null;
    }

    if (userIdScript) {
        try {
            userId = JSON.parse(userIdScript.textContent);
        } catch (e) {
            console.error("Error parsing userId:", e, "Content:", userIdScript.textContent);
            userId = null;
        }
    } else {
        console.error("userId script tag not found!");
        userId = null;
    }

    if (groupId === null || userId === null || !messageInput || !messageSendButton) {
        console.error("Critical DOM elements or IDs not found. Chat functionality may be impaired.");
        return; 
    }

    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${wsProtocol}://${window.location.host}/ws/group_chat/${groupId}/`);

    socket.onopen = (e) => {
        console.log('Group WebSocket opened', e);
    };

    socket.onmessage = (e) => {
        const data = JSON.parse(e.data);
        console.log('Message received:', data);

        if (data.type === 'chat_message') {
            const chatBox = document.getElementById('chatBox');
            const messageElement = document.createElement('div');
            messageElement.classList.add('chat-bubble');

            if (data.sender_id === userId) {
                messageElement.classList.add('sent');
            } else {
                messageElement.classList.add('received');
            }

            if (data.deleted_for_everyone || (data.deleted_for && data.deleted_for.includes(userId))) {
                 messageElement.classList.add('deleted');
                 messageElement.innerHTML = `<span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>`;
            } else {
                if (data.sender_id !== userId && data.sender_username) {
                    messageElement.innerHTML += `<strong style="color:#555;">${data.sender_username}</strong><br>`;
                }

                if (data.message) {
                    messageElement.innerHTML += `<span class="message-text">${data.message}</span>`;
                }
                if (data.file_url && data.file_name) {
                    if (data.message_type === 'image') {
                        messageElement.innerHTML += `<img src="${data.file_url}" alt="Image" class="chat-image-clickable" style="max-width: 150px; border-radius: 5px; cursor: pointer;">`;
                    } else if (data.message_type === 'video') {
                        messageElement.innerHTML += `<video controls style="max-width: 150px;"><source src="${data.file_url}"></video><br>`;
                    } else {
                        messageElement.innerHTML += `<a href="${data.file_url}" target="_blank" download="${data.file_name}">📎 ${data.file_name}</a><br>`;
                    }
                }
            }


            const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            messageElement.innerHTML += `<span class="message-time">${time}</span>`; 

            chatBox.appendChild(messageElement);
            chatBox.scrollTop = chatBox.scrollHeight; 
        }
    };

    socket.onclose = (e) => {
        console.log('Group WebSocket closed unexpectedly', e);
    };

    socket.onerror = (e) => {
        console.error('Group WebSocket error', e);
    };


    messageSendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        const selectedFile = fileInput.files[0];
        const messageType = messageTypeInput.value;

        if (message || selectedFile) {
            if (socket.readyState === WebSocket.OPEN) {
                let messageData = {
                    'type': 'send_group_message',
                    'group_id': groupId,
                    'message': message,
                    'message_type': messageType,
                    'file_url': null, 
                    'file_name': null
                };

                if (selectedFile) {
                    
                    const formData = new FormData();
                    formData.append('file', selectedFile);

                    formData.append('group_id', groupId);
                  
                    formData.append('csrfmiddlewaretoken', CSRF_TOKEN);

                    fetch('/upload_group_file/', { 
                        method: 'POST',
                        body: formData,
                    })
                    .then(response => response.json())
                    .then(data => {
    if (data.success) {
        messageData.file_url = data.file_url;
        messageData.file_name = selectedFile.name;
        messageData.message_type = data.message_type;

        socket.send(JSON.stringify(messageData));

        messageInput.value = '';
        fileInput.value = '';
        messageTypeInput.value = 'text';
    } else {
        console.error('File upload failed:', data.error);
        alert('File upload failed: ' + data.error);
    }
})

                    .catch(error => {
                        console.error('Error during file upload:', error);
                        alert('Error during file upload. Check console for details.');
                    });

                } else { 
                    socket.send(JSON.stringify(messageData));
                    messageInput.value = '';
                }

            } else {
                console.error("WebSocket is not open. ReadyState:", socket.readyState);
            }
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { 
            e.preventDefault();
            messageSendButton.click();
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            messageTypeInput.value = 'file'; 
        } else {
            messageTypeInput.value = 'text';
        }
    });

    const chatBox = document.getElementById('chatBox');
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
});