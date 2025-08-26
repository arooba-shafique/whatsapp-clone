import { getCookie } from './utils.js';

document.addEventListener("DOMContentLoaded", () => {
    const forwardModal = document.getElementById('forwardModal');
    const closeForwardButton = forwardModal?.querySelector('.close-button');
    const confirmForwardBtn = document.getElementById('confirmForwardBtn');
    const forwardOriginalMessageIdInput = document.getElementById('forwardOriginalMessageId');
    const forwardOriginalMessageTypeInput = document.getElementById('forwardOriginalMessageType');

    document.querySelectorAll('.forward-message-btn').forEach(button => {
        button.addEventListener('click', () => {
            forwardOriginalMessageIdInput.value = button.dataset.originalMessageId;
            forwardOriginalMessageTypeInput.value = button.dataset.originalMessageType;
            document.querySelectorAll('#forwardModal input[type="checkbox"]').forEach(cb => cb.checked = false);
            forwardModal.style.display = 'flex';
        });
    });

    closeForwardButton?.addEventListener('click', () => {
        forwardModal.style.display = 'none';
    });

    window.addEventListener('click', e => {
        if (e.target === forwardModal) forwardModal.style.display = 'none';
    });

    confirmForwardBtn?.addEventListener('click', async () => {
        const originalMessageId = forwardOriginalMessageIdInput.value;
        const originalMessageType = forwardOriginalMessageTypeInput.value;

        const allSelectedCheckboxes = document.querySelectorAll('input[name="forwardRecipient"]:checked');

        const selectedUserIds = [...allSelectedCheckboxes]
            .filter(cb => cb.dataset.type === 'user')
            .map(cb => cb.value);

        const selectedGroupIds = [...allSelectedCheckboxes]
            .filter(cb => cb.dataset.type === 'group')
            .map(cb => cb.value);

        if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
            alert("Please select at least one recipient (user or group).");
            return;
        }

        const getMessageDetails = async (msgId, msgType) => { 
            try {
                const res = await fetch(`/get-message-details/${msgType}/${msgId}/`, { 
                    method: 'GET',
                    headers: {
                        'X-CSRFToken': getCookie('csrftoken'),
                        'Accept': 'application/json'
                    }
                });
                if (!res.ok) {
                    const errorText = await res.text();
                    console.error(`HTTP error! status: ${res.status}, response: ${errorText}`);
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return await res.json();
            } catch (error) {
                console.error('Error fetching message details:', error);
                return null;
            }
        };

        const messageDetails = await getMessageDetails(originalMessageId, originalMessageType);

        if (!messageDetails || !messageDetails.success) {
            alert('Failed to retrieve original message details. Check console for errors.');
            return;
        }

        const { message_text, file_url, file_name, message_type } = messageDetails;

        const sendForwardRequest = async (recipientId, isGroup) => {
            const formData = new FormData();
            formData.append('message_id', originalMessageId);
            formData.append('original_message_type', originalMessageType);

            formData.append('is_forwarded', 'true');
            if (message_text) formData.append('message', message_text);
            if (file_url) {
                formData.append('file_url', file_url);
                formData.append('file_name', file_name);
                formData.append('message_type', message_type);
            } else {
                formData.append('message_type', 'text');
            }

            let url = isGroup ? '/forward/group/' : '/forward/user/';

            if (isGroup) formData.append('group_id', recipientId);
            else formData.append('recipient_id', recipientId);

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'X-CSRFToken': getCookie('csrftoken') },
                    body: formData
                });
                const data = await response.json();
                if (!data.success) {
                    console.error(`Error forwarding to ${isGroup ? 'group' : 'user'} ${recipientId}:`, data.error);
                }
                return data.success;
            } catch (error) {
                console.error(`Network error forwarding to ${isGroup ? 'group' : 'user'} ${recipientId}:`, error);
                return false;
            }
        };

        const results = await Promise.allSettled([
            ...selectedUserIds.map(id => sendForwardRequest(id, false)),
            ...selectedGroupIds.map(id => sendForwardRequest(id, true))
        ]);

        const allSuccessful = results.every(result => result.status === 'fulfilled' && result.value === true);

        if (allSuccessful) {
            alert('Messages forwarded to selected recipients.');
        } else {
            alert('Some messages failed to forward. Check console for details.');
        }
        forwardModal.style.display = 'none';
    });
});