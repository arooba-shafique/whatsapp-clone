import { getCSRFToken } from './utils.js';

export function handleReactionToggleClick() {

    document.querySelectorAll(".reaction-toggle").forEach(toggle => {
        toggle.addEventListener("click", async () => {
            const messageId = toggle.dataset.msgId;
            const emoji = toggle.dataset.emoji;
            if (!messageId || !emoji) return;

            try {
                const response = await fetch(`/toggle-reaction/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": getCSRFToken(),
                    },
                    body: JSON.stringify({ message_id: messageId, emoji: emoji }),
                });
                const data = await response.json();
                if (!data.success) {
                    console.error("Failed to toggle reaction:", data.error);
                }
            } catch (err) {
                console.error("Error toggling reaction:", err);
            }
        });
    });
}

export function setupEmojiReactions() {
    handleReactionToggleClick();
}
