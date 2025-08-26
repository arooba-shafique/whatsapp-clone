export function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            cookie = cookie.trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

export function getCSRFToken() {
    return getCookie('csrftoken') || '';
}

export function appendMessageToChatBox(messageData, chatBoxElement, currentUserId, isGroup) {
    const isSender = messageData.sender_id === currentUserId;
    const messageClass = isSender ? 'sent' : 'received';
    const senderName = messageData.sender_username || 'Unknown'; 
    const timestamp = messageData.timestamp || ''; 

    let messageContentHtml = '';

    if (messageData.message_type === 'text') {
        messageContentHtml = `<p>${messageData.message}</p>`;
    } else if (messageData.message_type === 'image') {
        messageContentHtml = `<img src="${messageData.file_url}" alt="Image" class="message-image">`;
    } else if (messageData.message_type === 'video') {
        messageContentHtml = `<video controls src="${messageData.file_url}" class="message-video"></video>`;
    } else if (messageData.message_type === 'file') {
        messageContentHtml = `<a href="${messageData.file_url}" target="_blank" class="message-file-link">
                                <i class="fa-solid fa-file-arrow-down"></i> ${messageData.file_name || 'File'}
                              </a>`;
    } else {
        messageContentHtml = `<p>${messageData.message || 'Unsupported message type'}</p>`;
    }


    const senderInfoHtml = (isGroup && !isSender) ? `<div class="sender-name">${senderName}</div>` : '';
    const readStatusHtml = (messageData.read_status && isSender && !isGroup) ?
                            `<span class="read-status">${messageData.read_status}</span>` : '';
    const starredHtml = messageData.is_starred ? `<span class="star-icon stared" data-msg-id="${messageData.id}"><i class="fa-solid fa-star"></i></span>` : `<span class="star-icon" data-msg-id="${messageData.id}"><i class="fa-regular fa-star"></i></span>`;

    const messageHtml = `
        <div class="chat-bubble ${messageClass}" data-id="${messageData.id}" data-is-sender="${isSender}" data-is-group="${isGroup}">
            <div class="message-content">
                ${senderInfoHtml}
                ${messageContentHtml}
                <div class="message-info">
                    <span class="message-time">${timestamp}</span>
                    ${readStatusHtml}
                    ${starredHtml}
                    <span class="delete-icon" data-msg-id="${messageData.id}" data-is-sender="${isSender}" data-is-group="${isGroup}">
                        <i class="fas fa-trash"></i>
                    </span>
                </div>
            </div> 
        </div>
    `;

    chatBoxElement.insertAdjacentHTML('beforeend', messageHtml);
}