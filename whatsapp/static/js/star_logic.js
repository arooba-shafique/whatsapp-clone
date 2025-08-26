document.addEventListener("click", function (e) {
  if (e.target.classList.contains("toggle-star")) {
    const icon = e.target;
    const messageId = icon.getAttribute("data-msg-id");
    const url = icon.getAttribute("data-url");

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken"),
      },
      body: JSON.stringify({ message_id: messageId }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "starred") {
          icon.classList.remove("unstarred-icon");
          icon.classList.add("starred-icon");
        } else if (data.status === "unstarred") {
          icon.classList.remove("starred-icon");
          icon.classList.add("unstarred-icon");
        }
      })
      .catch((error) => console.error("Error:", error));
  }
});


function getCookie(name) {
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}
