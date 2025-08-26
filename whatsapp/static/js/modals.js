import { globalData } from './globals.js';

export function attachDeleteButtonListeners() {
    const deleteModal = document.getElementById('deleteModal');
    const deleteForMeBtn = document.getElementById('deleteForMeBtn');
    const deleteForEveryoneBtn = document.getElementById('deleteForEveryoneBtn');
    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

    let currentMessageId = null;
    let isSender = false;
    let isGroupMessage = false;
    let currentGroupId = null;

    document.body.addEventListener('click', function(event) {
        const deleteIcon = event.target.closest('.delete-icon');
        if (deleteIcon) {
            currentMessageId = deleteIcon.dataset.msgId;
            isSender = deleteIcon.dataset.isSender === 'true';
            isGroupMessage = deleteIcon.dataset.isGroup === 'true';

            if (isGroupMessage) {
                currentGroupId = globalData.groupId;
                if (currentGroupId === null) {
                    console.error("Error: globalData.groupId variable is null for group message deletion.");
                    return;
                }
            } else {
                currentGroupId = null;
            }

            if (deleteModal) {
                deleteModal.style.display = 'flex';
            } else {
                console.error("Delete modal element (#deleteModal) not found.");
                return;
            }

            if (deleteForEveryoneBtn) {
                deleteForEveryoneBtn.style.display = isSender ? 'inline-block' : 'none';
            }
        }
    });

    function sendDeleteRequest(deleteType) {
        let url;
        if (isGroupMessage) {
            if (!currentGroupId || !currentMessageId) {
                console.error("Cannot send delete request: Missing Group ID or Message ID for group message.");
                return;
            }
            url = `/chat/group/${currentGroupId}/message/${currentMessageId}/delete/`;
        } else {
            if (!currentMessageId) {
                console.error("Cannot send delete request: Missing Message ID for private message.");
                return;
            }
            if (deleteType === 'for_me') {
                url = `/delete-message/${currentMessageId}/me/`;
            } else if (deleteType === 'for_everyone') {
                url = `/delete-message/${currentMessageId}/everyone/`;
            } else {
                console.error("Invalid delete type:", deleteType);
                return;
            }
        }

        fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': globalData.csrfToken
            },
            body: JSON.stringify({ delete_type: deleteType })
        })
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => {
                    throw new Error(`HTTP error! status: ${response.status}, message: ${text}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'success') {
                const messageElement = document.querySelector(`.chat-bubble[data-id="${currentMessageId}"]`);
                if (messageElement) {
                    if (deleteType === 'for_me') {
                        messageElement.remove();
                    } else if (deleteType === 'for_everyone') {
                        messageElement.classList.add('deleted');
                        const senderNameHtml = (isGroupMessage && !isSender && data.sender_username) ?
                            `<strong style="color:#555;">${data.sender_username}</strong><br>` : '';
                        const timestampHtml = data.timestamp ?
                            `<span class="message-time">${data.timestamp}</span>` : '';
                        messageElement.innerHTML = `
                            ${senderNameHtml}
                            <span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>
                            <div class="reaction-display" id="reactions-${currentMessageId}" style="margin-top: 4px;"></div>
                            ${timestampHtml}
                        `;
                        const deleteIconAfterUpdate = messageElement.querySelector('.delete-icon');
                        if (deleteIconAfterUpdate) {
                            deleteIconAfterUpdate.remove();
                        }
                    }
                } else {
                    console.warn(`Message element with data-id="${currentMessageId}" not found in DOM.`);
                }
            } else {
                alert(' ' + (data.message || 'Unknown error.'));
                console.error('Server error:', data.message);
            }
        })
        .catch(error => {
            console.error('Fetch Error during message deletion:', error);
            alert('A network error occurred while trying to delete the message.');
        })
        .finally(() => {
            if (deleteModal) deleteModal.style.display = 'none';
            currentMessageId = null;
            isSender = false;
            isGroupMessage = false;
            currentGroupId = null;
        });
    }

    if (deleteForMeBtn) {
        deleteForMeBtn.addEventListener('click', function() {
            if (currentMessageId) sendDeleteRequest('for_me');
        });
    }

    if (deleteForEveryoneBtn) {
        deleteForEveryoneBtn.addEventListener('click', function() {
            if (currentMessageId) sendDeleteRequest('for_everyone');
        });
    }

    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', function() {
            if (deleteModal) deleteModal.style.display = 'none';
            currentMessageId = null;
            isSender = false;
            isGroupMessage = false;
            currentGroupId = null;
        });
    }

    window.addEventListener('click', function(event) {
        if (event.target === deleteModal) {
            deleteModal.style.display = 'none';
            currentMessageId = null;
            isSender = false;
            isGroupMessage = false;
            currentGroupId = null;
        }
    });
}

document.addEventListener('DOMContentLoaded', attachDeleteButtonListeners);
