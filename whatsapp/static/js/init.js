import { setupEmojiReactions } from './emoji_reactions.js';
import { attachDeleteButtonListeners } from './modals.js';
import { scrollToBottom } from './messages.js';
import { setupEmojiPicker } from './emoji_picker.js';

window.setupEmojiReactions = setupEmojiReactions;
window.attachDeleteButtonListeners = attachDeleteButtonListeners; 
window.setupForwardMessageLogic = () => {}; 

document.addEventListener("DOMContentLoaded", () => {
    setupEmojiReactions();
    attachDeleteButtonListeners();
    scrollToBottom();
    setupEmojiPicker();
});