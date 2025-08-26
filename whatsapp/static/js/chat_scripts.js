function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Function to handle reaction toggle clicks (showing/hiding the emoji menu)
function handleReactionToggleClick() {
    console.log("setupEmojiReactions running");
    const reactionToggles = document.querySelectorAll(".reaction-toggle");
    console.log("found icons:", reactionToggles.length);

    reactionToggles.forEach(icon => {
        console.log("Attaching to icon:", icon);
        // Ensure only one click listener to avoid multiple firings
        icon.onclick = null; // Clear existing handler
        icon.onclick = function(event) {
            event.stopPropagation(); // Prevent document click from immediately closing it
            const msgId = this.dataset.msgId;
            const menu = document.getElementById(`reaction-menu-${msgId}`);

            if (!menu) {
                console.warn(`Reaction menu not found for message ID: ${msgId}`);
                return;
            }

            // Hide all other open reaction menus
            document.querySelectorAll(".reaction-menu").forEach(m => {
                if (m !== menu) { // Don't hide the current menu initially
                    m.style.display = "none";
                }
            });

            // Toggle display for the clicked menu
            if (menu.style.display === "block") {
                menu.style.display = "none";
            } else {
                menu.style.display = "block";
            }
        };
    });

    // Function to handle specific emoji button clicks (sending the reaction)
    const reactionButtons = document.querySelectorAll(".reaction-btn");
    reactionButtons.forEach(btn => {
        btn.onclick = null; // Clear existing handler
        btn.onclick = function () {
            const emoji = this.dataset.emoji;
            const messageId = this.dataset.msgId;

            // Determine if it's a group message by checking the data-is-group attribute
            // This assumes the `chat-bubble` element (or a parent) has data-is-group="true"
            const chatBubble = this.closest('.chat-bubble');
            const isGroupMessage = chatBubble ? chatBubble.dataset.isGroup === 'true' : false;

            // Dynamically set the URL based on message type
            const url = isGroupMessage ? "/group-react/" : "/add-reaction/";

            fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ emoji: emoji, message_id: messageId }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const container = document.getElementById(`reactions-${messageId}`);
                    if (container) {
                        container.innerHTML = data.reactions_html;
                        // Re-setup emoji reactions to ensure new reaction bubbles are interactive if needed
                        setupEmojiReactions(); // Important: rebind events for newly loaded HTML
                    } else {
                        console.warn(`Reaction container not found for message ID: ${messageId}`);
                    }
                } else {
                    console.error('Error adding reaction:', data.error || 'Unknown error');
                }
            })
            .catch(error => console.error('Error adding reaction:', error));

            // Hide the reaction menu after selection
            const menu = document.getElementById(`reaction-menu-${messageId}`);
            if (menu) {
                menu.style.display = "none";
            }
        };
    });

    // Close reaction menus if clicked outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".reaction-menu") && !event.target.closest(".reaction-toggle")) {
            document.querySelectorAll(".reaction-menu").forEach(menu => {
                menu.style.display = "none";
            });
        }
    });
}

// Initial call when the DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    handleReactionToggleClick();
    setupModals();
    setupForwardMessageLogic();
    

    // --- NEW CODE FOR DROPDOWNS ---
    const statusIcon = document.getElementById('statusIcon');
    const statusMenu = document.getElementById('statusMenu');

    if (statusIcon && statusMenu) {
        statusIcon.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent click from bubbling up and closing other menus
            statusMenu.style.display = statusMenu.style.display === 'none' ? 'block' : 'none';
        });
    }

    const settingsIcon = document.getElementById('settingsIcon');
    const settingsMenu = document.getElementById('settingsMenu');

    if (settingsIcon && settingsMenu) {
        settingsIcon.addEventListener('click', function(event) {
            event.stopPropagation(); // Prevent click from bubbling up and closing other menus
            settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
        });
    }

    const menuIcon = document.getElementById('menuIcon'); // This is the sidebar header menu icon
    const menuDropdown = document.querySelector('.menuDropdown'); // This is the sidebar header menu dropdown

    if (menuIcon && menuDropdown) {
        menuIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'block' : 'none';
        });
    }


    // Close all dropdowns if clicked anywhere else on the document
    document.addEventListener('click', function(event) {
        // Close Status Menu
        if (statusMenu && statusMenu.style.display === 'block' && !statusMenu.contains(event.target) && event.target !== statusIcon) {
            statusMenu.style.display = 'none';
        }
        // Close Settings Menu
        if (settingsMenu && settingsMenu.style.display === 'block' && !settingsMenu.contains(event.target) && event.target !== settingsIcon) {
            settingsMenu.style.display = 'none';
        }
        // Close Sidebar Header Menu
        if (menuDropdown && menuDropdown.style.display === 'block' && !menuDropdown.contains(event.target) && event.target !== menuIcon) {
            menuDropdown.style.display = 'none';
        }
    });
    // --- END NEW CODE ---
});


// Add this dummy function if you don't have it, to prevent errors for now
// You'll need to integrate your actual modal setup logic here
function setupModals() {
    let currentMsgId = null;
    let currentIsSender = false;
    let currentMsgText = null;
    let currentMsgType = null;
    let currentMsgFile = null;
    let currentMsgFilename = null;


    // Attach click listener to all trash icons
    document.querySelectorAll(".delete-icon").forEach(icon => {
        icon.addEventListener("click", function () {
            currentMsgId = this.dataset.msgId;
            currentIsSender = this.dataset.isSender === "true";

            // Show modal
            document.getElementById("deleteModal").style.display = "flex";

            // Show 'delete for everyone' button only if the sender
            const everyoneBtn = document.getElementById("deleteForEveryoneBtn");
            everyoneBtn.style.display = currentIsSender ? "inline-block" : "none";
        });
    });

    // Delete for me
    document.getElementById("deleteForMeBtn").addEventListener("click", function () {
        let deleteUrl = `/delete-message/${currentMsgId}/me/`;
        if (document.getElementById("groupId")) {
            const groupId = document.getElementById("groupId").dataset.groupId;
            deleteUrl = `/delete-group-message/${groupId}/${currentMsgId}/me/`;
        }
        fetch(deleteUrl, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken")
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const bubble = document.querySelector(`[data-id="${currentMsgId}"]`);
                if (bubble) {
                    bubble.innerHTML = `<span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>`;
                }
                document.getElementById("deleteModal").style.display = "none";
            } else {
                alert(data.error || "Error deleting for me.");
            }
        });
    });

    // Delete for everyone
    document.getElementById("deleteForEveryoneBtn").addEventListener("click", function () {
        let deleteEveryoneUrl = `/delete-message/${currentMsgId}/everyone/`;
        if (document.getElementById("groupId")) {
            const groupId = document.getElementById("groupId").dataset.groupId;
            deleteEveryoneUrl = `/delete-group-message/${groupId}/${currentMsgId}/everyone/`;
        }
        fetch(deleteEveryoneUrl, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken")
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const bubble = document.querySelector(`[data-id="${currentMsgId}"]`);
                if (bubble) {
                    bubble.innerHTML = `<span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>`;
                }
                document.getElementById("deleteModal").style.display = "none";
            } else {
                alert(data.error || "Error deleting for everyone.");
            }
        });
    });
}


// chat_scripts.js

function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

// Function to handle reaction toggle clicks (showing/hiding the emoji menu)
function handleReactionToggleClick() {
    console.log("setupEmojiReactions running");
    const reactionToggles = document.querySelectorAll(".reaction-toggle");
    console.log("found icons:", reactionToggles.length);

    reactionToggles.forEach(icon => {
        console.log("Attaching to icon:", icon);
        // Ensure only one click listener to avoid multiple firings
        icon.onclick = null; // Clear existing handler
        icon.onclick = function(event) {
            event.stopPropagation(); // Prevent document click from immediately closing it
            const msgId = this.dataset.msgId;
            const menu = document.getElementById(`reaction-menu-${msgId}`);

            if (!menu) {
                console.warn(`Reaction menu not found for message ID: ${msgId}`);
                return;
            }

            // Hide all other open reaction menus
            document.querySelectorAll(".reaction-menu").forEach(m => {
                if (m !== menu) { // Don't hide the current menu initially
                    m.style.display = "none";
                }
            });

            // Toggle display for the clicked menu
            if (menu.style.display === "block") {
                menu.style.display = "none";
            } else {
                menu.style.display = "block";
            }
        };
    });

    // Function to handle specific emoji button clicks (sending the reaction)
    const reactionButtons = document.querySelectorAll(".reaction-btn");
    reactionButtons.forEach(btn => {
        btn.onclick = null; // Clear existing handler
        btn.onclick = function () {
            const emoji = this.dataset.emoji;
            const messageId = this.dataset.msgId;

            // Determine if it's a group message by checking the data-is-group attribute
            const chatBubble = this.closest('.chat-bubble');
            const isGroupMessage = chatBubble ? chatBubble.dataset.isGroup === 'true' : false;

            const url = isGroupMessage ? "/group-react/" : "/add-reaction/";

            fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCookie("csrftoken"),
                },
                body: JSON.stringify({ emoji: emoji, message_id: messageId }),
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    const container = document.getElementById(`reactions-${messageId}`);
                    if (container) {
                        container.innerHTML = data.reactions_html;
                        setupEmojiReactions(); // Important: rebind events for newly loaded HTML
                    } else {
                        console.warn(`Reaction container not found for message ID: ${messageId}`);
                    }
                } else {
                    console.error('Error adding reaction:', data.error || 'Unknown error');
                }
            })
            .catch(error => console.error('Error adding reaction:', error));

            const menu = document.getElementById(`reaction-menu-${messageId}`);
            if (menu) {
                menu.style.display = "none";
            }
        };
    });

    // Close reaction menus if clicked outside
    document.addEventListener("click", function(event) {
        if (!event.target.closest(".reaction-menu") && !event.target.closest(".reaction-toggle")) {
            document.querySelectorAll(".reaction-menu").forEach(menu => {
                menu.style.display = "none";
            });
        }
    });
}

// Initial call when the DOM is loaded
document.addEventListener("DOMContentLoaded", function() {
    handleReactionToggleClick();
    setupModals(); // This now correctly calls the consolidated delete/forward logic
    setupForwardMessageLogic(); // Renamed to avoid confusion with the old one

    // --- NEW CODE FOR DROPDOWNS (already well-structured) ---
    const statusIcon = document.getElementById('statusIcon');
    const statusMenu = document.getElementById('statusMenu');

    if (statusIcon && statusMenu) {
        statusIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            statusMenu.style.display = statusMenu.style.display === 'none' ? 'block' : 'none';
        });
    }

    const settingsIcon = document.getElementById('settingsIcon');
    const settingsMenu = document.getElementById('settingsMenu');

    if (settingsIcon && settingsMenu) {
        settingsIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            settingsMenu.style.display = settingsMenu.style.display === 'none' ? 'block' : 'none';
        });
    }

    const menuIcon = document.getElementById('menuIcon');
    const menuDropdown = document.querySelector('.menuDropdown');

    if (menuIcon && menuDropdown) {
        menuIcon.addEventListener('click', function(event) {
            event.stopPropagation();
            menuDropdown.style.display = menuDropdown.style.display === 'none' ? 'block' : 'none';
        });
    }

    // Close all dropdowns if clicked anywhere else on the document
    document.addEventListener('click', function(event) {
        if (statusMenu && statusMenu.style.display === 'block' && !statusMenu.contains(event.target) && event.target !== statusIcon) {
            statusMenu.style.display = 'none';
        }
        if (settingsMenu && settingsMenu.style.display === 'block' && !settingsMenu.contains(event.target) && event.target !== settingsIcon) {
            settingsMenu.style.display = 'none';
        }
        if (menuDropdown && menuDropdown.style.display === 'block' && !menuDropdown.contains(event.target) && event.target !== menuIcon) {
            menuDropdown.style.display = 'none';
        }
    });
    // --- END NEW CODE ---
});


function setupModals() {
    let currentMsgId = null;
    let currentIsSender = false;
    let currentIsGroupMessage = false; // Add this to manage group vs private delete

    // Attach click listener to all trash icons
    document.querySelectorAll(".delete-icon").forEach(icon => {
        icon.addEventListener("click", function () {
            currentMsgId = this.dataset.msgId;
            currentIsSender = this.dataset.isSender === "true";
            currentIsGroupMessage = this.dataset.isGroup === "true"; // Get the type here

            // Show modal
            document.getElementById("deleteModal").style.display = "flex";

            // Show 'delete for everyone' button only if the sender
            const everyoneBtn = document.getElementById("deleteForEveryoneBtn");
            everyoneBtn.style.display = currentIsSender ? "inline-block" : "none";
        });
    });

    // Delete for me
    document.getElementById("deleteForMeBtn").addEventListener("click", function () {
        let deleteUrl;
        if (currentIsGroupMessage) {
            // Ensure groupId is correctly derived. From the current page context if available.
            // This needs to be pulled from the HTML structure, e.g., <div id="groupId" data-group-id="{{ group.id }}"></div>
            const groupIdElement = document.getElementById("groupId");
            const groupId = groupIdElement ? groupIdElement.dataset.groupId : '';
            if (!groupId) {
                console.error("Group ID not found for group message deletion.");
                alert("Error: Could not determine group for deletion.");
                document.getElementById("deleteModal").style.display = "none";
                return;
            }
            deleteUrl = `/delete-group-message/${groupId}/${currentMsgId}/me/`;
        } else {
            deleteUrl = `/delete-message/${currentMsgId}/me/`;
        }
        fetch(deleteUrl, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken")
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const bubble = document.querySelector(`[data-id="${currentMsgId}"]`);
                if (bubble) {
                    bubble.innerHTML = `<span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>`;
                }
                document.getElementById("deleteModal").style.display = "none";
            } else {
                alert(data.error || "Error deleting for me.");
            }
        })
        .catch(error => console.error('Error:', error));
    });

    // Delete for everyone
    document.getElementById("deleteForEveryoneBtn").addEventListener("click", function () {
        let deleteEveryoneUrl;
        if (currentIsGroupMessage) {
            const groupIdElement = document.getElementById("groupId");
            const groupId = groupIdElement ? groupIdElement.dataset.groupId : '';
            if (!groupId) {
                console.error("Group ID not found for group message deletion (everyone).");
                alert("Error: Could not determine group for deletion.");
                document.getElementById("deleteModal").style.display = "none";
                return;
            }
            deleteEveryoneUrl = `/delete-group-message/${groupId}/${currentMsgId}/everyone/`;
        } else {
            deleteEveryoneUrl = `/delete-message/${currentMsgId}/everyone/`;
        }
        fetch(deleteEveryoneUrl, {
            method: "POST",
            headers: {
                "X-CSRFToken": getCookie("csrftoken")
            }
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const bubble = document.querySelector(`[data-id="${currentMsgId}"]`);
                if (bubble) {
                    bubble.innerHTML = `<span class="deleted-message" style="font-style: italic; color: gray;">This message was deleted</span>`;
                }
                document.getElementById("deleteModal").style.display = "none";
            } else {
                alert(data.error || "Error deleting for everyone.");
            }
        })
        .catch(error => console.error('Error:', error));
    });
}


// Consolidated Forward Message Logic
function setupForwardMessageLogic() {
    const forwardModal = document.getElementById('forwardModal');
    const closeForwardButton = forwardModal ? forwardModal.querySelector('.close-button') : null;
    const confirmForwardBtn = document.getElementById('confirmForwardBtn'); // Correct ID for the button
    const forwardOriginalMessageIdInput = document.getElementById('forwardOriginalMessageId');
    const forwardOriginalMessageTypeInput = document.getElementById('forwardOriginalMessageType');

    // Attach click listener to all forward icons
    // IMPORTANT: Use the correct class name from your HTML
    document.querySelectorAll('.forward-message-btn').forEach(button => {
        button.addEventListener('click', function() {
            // Store the original message ID and type (chat/group)
            forwardOriginalMessageIdInput.value = this.dataset.originalMessageId;
            forwardOriginalMessageTypeInput.value = this.dataset.originalMessageType;

            // Reset all checkboxes (important for multiple forwards)
            document.querySelectorAll('#forwardModal input[type="checkbox"]').forEach(cb => cb.checked = false);

            if (forwardModal) {
                forwardModal.style.display = 'flex'; // Use 'flex' for vertical centering
            }
        });
    });

    // Close the modal
    if (closeForwardButton) {
        closeForwardButton.addEventListener('click', function() {
            if (forwardModal) {
                forwardModal.style.display = 'none';
            }
        });
    }

    // Close modal if clicked outside
    window.addEventListener('click', function(event) {
        if (event.target == forwardModal) {
            forwardModal.style.display = 'none';
        }
    });

    // Handle the "Forward Selected" button click
    if (confirmForwardBtn) {
        confirmForwardBtn.addEventListener('click', async function() {
            const originalMessageId = forwardOriginalMessageIdInput.value;
            const originalMessageType = forwardOriginalMessageTypeInput.value; // 'chat' or 'group'

            const selectedUserIds = [];
            document.querySelectorAll('.forward-to-user-checkbox:checked').forEach(checkbox => {
                selectedUserIds.push(checkbox.value); // Use .value, not .dataset.userId
            });

            const selectedGroupIds = [];
            document.querySelectorAll('.forward-to-group-checkbox:checked').forEach(checkbox => {
                selectedGroupIds.push(checkbox.value); // Use .value, not .dataset.groupId
            });

            if (selectedUserIds.length === 0 && selectedGroupIds.length === 0) {
                alert("Please select at least one recipient (user or group).");
                return;
            }

            // Function to fetch message details (text/file)
            const getMessageDetails = async (msgId) => { // Removed msgType as it's not strictly needed for the URL in this context
                let url = `/get-message-details/${msgId}/`; // Assuming one endpoint handles both private/group messages
                try {
                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'X-CSRFToken': getCookie('csrftoken'),
                            'Accept': 'application/json'
                        }
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    console.error('Error fetching message details:', error);
                    return null;
                }
            };

            const messageDetails = await getMessageDetails(originalMessageId);

            if (!messageDetails || !messageDetails.success) {
                alert('Failed to retrieve original message details for forwarding. Check console for details.');
                console.error('Message details:', messageDetails);
                return;
            }

            const currentMsgText = messageDetails.message_text;
            const currentMsgFileUrl = messageDetails.file_url;
            const currentMsgFileName = messageDetails.file_name;
            const currentMsgFileType = messageDetails.message_type; // e.g., 'text', 'image', 'video', 'file'

            const sendForwardRequest = async (recipientId, isGroup) => {
                const formData = new FormData();
                formData.append('message_id', originalMessageId); // The ID of the original message
                formData.append('original_message_type', originalMessageType); // Tell backend if original was chat or group
                formData.append('is_forwarded', 'true'); // Indicate it's a forwarded message

                // Append the actual content
                if (currentMsgText) {
                    formData.append('message', currentMsgText);
                }
                if (currentMsgFileUrl) {
                    formData.append('file_url', currentMsgFileUrl); // Pass URL, backend will handle
                    formData.append('file_name', currentMsgFileName);
                    formData.append('message_type', currentMsgFileType); // Pass the type of the file (image, video, etc.)
                } else {
                    // Only append message_type as 'text' if there's no file and there IS text.
                    // If no text and no file, it's an empty message, which might be an error.
                    if (currentMsgText) {
                        formData.append('message_type', 'text');
                    }
                }


                let url = '';
                if (isGroup) {
                    formData.append('group_id', recipientId);
                    url = '/forward-message/group/'; // Your group forwarding URL
                } else {
                    formData.append('recipient_id', recipientId);
                    url = '/forward-message/user/'; // Your private chat forwarding URL
                }

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': getCookie('csrftoken'),
                        },
                        body: formData
                    });
                    const data = await response.json();
                    if (data.success) {
                        console.log(`Message forwarded successfully to ${isGroup ? 'group' : 'user'} ${recipientId}!`);
                    } else {
                        console.error(`Error forwarding message to ${isGroup ? 'group' : 'user'} ${recipientId}:`, data.error || 'Unknown error');
                    }
                } catch (error) {
                    console.error(`Network error forwarding to ${isGroup ? 'group' : 'user'} ${recipientId}:`, error);
                }
            };

            // Send requests concurrently
            const forwardPromises = [];
            selectedUserIds.forEach(userId => {
                forwardPromises.push(sendForwardRequest(userId, false));
            });
            selectedGroupIds.forEach(groupId => {
                forwardPromises.push(sendForwardRequest(groupId, true));
            });

            await Promise.all(forwardPromises); // Wait for all forwarding requests to complete

            alert('Messages are being forwarded to selected recipients. Check console for status.');
            if (forwardModal) {
                forwardModal.style.display = 'none'; // Close the modal after sending
            }
        });
    }
}

// Function for auto-scrolling
function scrollToBottom() {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Call scrollToBottom on page load
document.addEventListener("DOMContentLoaded", scrollToBottom);

// Adjust textarea height dynamically
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
});

// Check new messages function (your existing logic)
function checkNewMessages() {
    const checkUrlElement = document.getElementById('checkNewMessagesUrl');
    if (!checkUrlElement) {
        return; // Not on a chat page or element is missing
    }
    const checkUrl = checkUrlElement.dataset.url;
    let currentChatId = '';
    let isGroupChat = false;

    const receiverIdElement = document.getElementById('receiverId');
    const groupIdElement = document.getElementById('groupId');

    if (groupIdElement && groupIdElement.dataset.groupId) {
        currentChatId = groupIdElement.dataset.groupId;
        isGroupChat = true;
    } else if (receiverIdElement && receiverIdElement.dataset.receiverId) {
        currentChatId = receiverIdElement.dataset.receiverId;
    } else {
        return; // No active chat detected
    }

    if (!currentChatId) {
        return;
    }

    fetch(checkUrl, {
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
    .then(response => response.json())
    .then(data => {
        if (data.new_messages_html) {
            const chatBox = document.getElementById('chatBox');
            if (chatBox) {
                const atBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 1;
                chatBox.insertAdjacentHTML('beforeend', data.new_messages_html);
                if (atBottom) {
                    scrollToBottom();
                }
                // Re-setup event listeners for new messages
                handleReactionToggleClick(); // For new emoji toggles
                setupModals(); // For new delete/forward icons (re-attaches listeners for all)
                setupForwardMessageLogic(); // Re-attaches listeners for forward buttons
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


function getLastMessageId() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return 0;
    const messages = chatBox.querySelectorAll('.chat-bubble[data-id]');
    if (messages.length > 0) {
        return parseInt(messages[messages.length - 1].dataset.id);
    }
    return 0;
}


// Fetch new messages every 3 seconds
setInterval(checkNewMessages, 3000);

// Toggle star message

// Function for auto-scrolling
function scrollToBottom() {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

// Call scrollToBottom on page load
document.addEventListener("DOMContentLoaded", scrollToBottom);

// Optional: Auto-scroll on new messages (if you have a mechanism for live updates)
// Example: if you fetch new messages via AJAX, call scrollToBottom after update.

// Adjust textarea height dynamically
document.addEventListener('DOMContentLoaded', function() {
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
});


// Dummy function for setupEmojiReactions if it's called elsewhere (ensure only one definition)
function setupEmojiReactions() {
    // Just call the main handler as it sets up all reaction-related events
    handleReactionToggleClick();
}


// Check new messages function (your existing logic)
// You might want to move the actual checking logic from here if it's in chat_scripts.js
// and just define the wrapper. For now, assuming it's correctly placed.
function checkNewMessages() {
    const checkUrlElement = document.getElementById('checkNewMessagesUrl');
    if (!checkUrlElement) {
        // This is not an active chat page, or element is missing, skip checking
        return;
    }
    const checkUrl = checkUrlElement.dataset.url;
    let currentChatId = '';
    let isGroupChat = false;

    const receiverIdElement = document.getElementById('receiverId');
    const groupIdElement = document.getElementById('groupId');

    if (groupIdElement && groupIdElement.dataset.groupId) {
        currentChatId = groupIdElement.dataset.groupId;
        isGroupChat = true;
    } else if (receiverIdElement && receiverIdElement.dataset.receiverId) {
        currentChatId = receiverIdElement.dataset.receiverId;
    } else {
        // No active chat detected, perhaps homepage or settings
        return;
    }

    if (!currentChatId) {
        return;
    }

    fetch(checkUrl, {
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
    .then(response => response.json())
    .then(data => {
        if (data.new_messages_html) {
            const chatBox = document.getElementById('chatBox');
            if (chatBox) {
                const atBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 1;
                chatBox.insertAdjacentHTML('beforeend', data.new_messages_html);
                if (atBottom) {
                    scrollToBottom();
                }
                // Re-setup event listeners for new messages
                handleReactionToggleClick(); // For new emoji toggles
                setupModals(); // For new delete/forward icons
                setupForwardMessageLogic();
            }
            // Update chat list for notifications or last message
            if (data.chat_notification_html) {
                const sidebarUserList = document.querySelector('.user-list');
                if (sidebarUserList) {
                    sidebarUserList.innerHTML = data.chat_notification_html;
                    // You might need to rebind listeners for sidebar elements if they exist
                }
            }

            // Show chat notification dot if there are unseen messages on the sidebar
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


function getLastMessageId() {
    const chatBox = document.getElementById('chatBox');
    if (!chatBox) return 0;
    const messages = chatBox.querySelectorAll('.chat-bubble[data-id]');
    if (messages.length > 0) {
        return parseInt(messages[messages.length - 1].dataset.id);
    }
    return 0;
}


// Fetch new messages every 3 seconds
setInterval(checkNewMessages, 3000);

// Toggle star message

document.addEventListener("DOMContentLoaded", function () {
    document.addEventListener("click", function (event) {
        if (event.target.classList.contains("toggle-star")) {
            const starIcon = event.target;
            const messageId = starIcon.getAttribute("data-msg-id");
            if (!messageId) {
                console.error("No message ID provided");
                return;
            }

            const url = document.getElementById("toggleStarUrl").value;

            fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CSRFToken": getCSRFToken(),
                },
                body: JSON.stringify({ message_id: messageId }),
            })
            .then(response => response.json())
            .then(data => {
                if (data.starred) {
                    starIcon.classList.remove("unstarred-icon");
                    starIcon.classList.add("starred-icon");
                    starIcon.title = "Unstar";
                } else {
                    starIcon.classList.remove("starred-icon");
                    starIcon.classList.add("unstarred-icon");
                    starIcon.title = "Star";
                }
            })
            .catch(error => {
                console.error("Error updating star status:", error);
            });
        }
    });
});



document.addEventListener("DOMContentLoaded", function () {
  const starIcons = document.querySelectorAll(".star-icon");

  starIcons.forEach((icon) => {
    icon.addEventListener("click", () => {
      const messageId = icon.dataset.messageId;
      if (!messageId) return; // 🛑 Prevent blank messageId fetch

      fetch("/toggle_star/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ message_id: messageId }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.status === "starred") {
            icon.classList.remove("fa-regular");
            icon.classList.add("fa-solid");
          } else if (data.status === "unstarred") {
            icon.classList.remove("fa-solid");
            icon.classList.add("fa-regular");
          } else if (data.status === "error") {
            console.error("Error:", data.message);
          }
        });
    });
  });
});


function getCSRFToken() {
    const cookieValue = document.cookie
        .split("; ")
        .find((row) => row.startsWith("csrftoken="))
        ?.split("=")[1];
    return cookieValue || "";
}



let messageId = null;  // Store the message being forwarded

const forwardButtons = document.querySelectorAll(".forward-btn");
const forwardModal = document.getElementById("forwardModal");

forwardButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const messageDiv = button.closest(".message");
    if (!messageDiv) {
      console.error("No .message container found");
      return;
    }

    const msgId = messageDiv.getAttribute("data-message-id");
    if (!msgId) {
      console.error("No message ID found in data attribute");
      return;
    }

    messageId = msgId; // ✅ Save for use in fetch later
    forwardModal.style.display = "block";
  });
});

// Forward to user
document.getElementById("forwardToUserBtn")?.addEventListener("click", () => {
  const selectedUser = document.getElementById("userSelect").value;
  if (!messageId || !selectedUser) return;

  fetch("/forward_to_user/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({ message_id: messageId, recipient_id: selectedUser }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        alert("Message forwarded to user");
        forwardModal.style.display = "none";
      } else {
        alert("Failed to forward");
      }
    });
});

// Forward to group
document.getElementById("forwardToGroupBtn")?.addEventListener("click", () => {
  const selectedGroup = document.getElementById("groupSelect").value;
  if (!messageId || !selectedGroup) return;

  fetch("/forward_to_group/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({ message_id: messageId, group_id: selectedGroup }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        alert("Message forwarded to group");
        forwardModal.style.display = "none";
      } else {
        alert("Failed to forward");
      }
    });
});


