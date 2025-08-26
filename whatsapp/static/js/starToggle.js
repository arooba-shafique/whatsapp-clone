
import { csrfToken } from './csrf.js';

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
                    "X-CSRFToken": csrfToken,
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
