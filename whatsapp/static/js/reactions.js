import { getCookie } from './utils.js';

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.reaction-toggle').forEach(icon => {
        icon.addEventListener('click', e => {
            e.stopPropagation();
            const msgId = icon.dataset.msgId;
            const reactionMenu = document.getElementById(`reaction-menu-${msgId}`);

            document.querySelectorAll('.reaction-menu').forEach(menu => {
                if (menu.id !== `reaction-menu-${msgId}`) {
                    menu.style.display = 'none';
                }
            });

            reactionMenu.style.display = reactionMenu.style.display === 'block' ? 'none' : 'block';
        });
    });

    document.querySelectorAll('.reaction-btn').forEach(button => {
        button.addEventListener('click', () => {
            const msgId = button.dataset.msgId;
            const emoji = button.dataset.emoji;
            const isGroup = button.dataset.isGroup === 'true';
            const groupId = button.dataset.groupId;

            let url;
            if (isGroup) {
                url = `/group/${groupId}/message/${msgId}/react/`;
            } else {
                url = `/react/`;
            }

            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ message_id: msgId, emoji })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const container = document.getElementById(`reactions-${msgId}`);
                    if (container) container.innerHTML = data.reactions_html;

                    const reactionMenu = document.getElementById(`reaction-menu-${msgId}`);
                    if (reactionMenu) reactionMenu.style.display = 'none';
                } else {
                    alert('Failed to add reaction: ' + data.error);
                }
            })
            .catch(console.error);
        });
    });

    document.addEventListener('click', e => {
        document.querySelectorAll('.reaction-menu').forEach(menu => {
            const toggleBtn = menu.previousElementSibling;
            if (menu.style.display === 'block' && !menu.contains(e.target) && !toggleBtn.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    });
});
