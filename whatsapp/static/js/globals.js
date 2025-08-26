
let globalData = {
    currentUserId: null,
    csrfToken: null,
    isGroup: false, 
    groupId: null,  
    receiverId: null, 
    checkNewMessagesUrl: null,
    toggleStarUrl: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("globals.js: DOMContentLoaded fired.");
    const globalDataScript = document.getElementById('global-data');

    if (globalDataScript) {
        try {
            const data = JSON.parse(globalDataScript.textContent);
            globalData.currentUserId = data.currentUserId;
            globalData.csrfToken = data.csrfToken;
            globalData.isGroup = data.isGroup;
            globalData.groupId = data.groupId;
            globalData.receiverId = data.receiverId;
            globalData.checkNewMessagesUrl = data.checkNewMessagesUrl;
            globalData.toggleStarUrl = data.toggleStarUrl;

            console.log("globals.js: globalData populated:", globalData);
        } catch (e) {
            console.error("globals.js: Failed to parse global data from script tag:", e);
        }
    } else {
        console.warn("globals.js: Script tag with ID 'global-data' not found.");
    }
});

import './search.js'; 
export { globalData };