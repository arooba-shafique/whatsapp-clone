import { EmojiButton } from 'https://cdn.jsdelivr.net/npm/@joeattardi/emoji-button@4.6.4/dist/index.min.js';

export function setupEmojiPicker() {
    const emojiBtn = document.querySelector('#emoji-button');
    const input = document.querySelector('#messageInput'); 

    if (!emojiBtn || !input) {
        console.warn("Emoji button or message input element not found. Emoji picker setup skipped.");
        return; 
    }

    const picker = new EmojiButton({
        position: 'top-end',
        theme: 'auto'
    });

    picker.on('emoji', emoji => {
        input.value += emoji;
    });

    emojiBtn.addEventListener('click', () => {
        picker.togglePicker(emojiBtn);
    });
}

