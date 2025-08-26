document.addEventListener("DOMContentLoaded", () => {
  const toggleStarUrl = document.getElementById('toggleStarUrl')?.value;
  if (!toggleStarUrl) {
    console.error("Toggle star URL not found.");
    return;
  }

  document.querySelectorAll('.toggle-star').forEach(starIcon => {
    starIcon.addEventListener('click', () => {
      const msgId = starIcon.dataset.msgId;
      if (!msgId) return;

      fetch(toggleStarUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': getCookie('csrftoken')
        },
        body: `message_id=${encodeURIComponent(msgId)}`
      })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          starIcon.classList.toggle('starred-icon', data.is_starred);
          starIcon.classList.toggle('unstarred-icon', !data.is_starred);
          starIcon.title = data.is_starred ? 'Unstar' : 'Star';
        } else {
          alert('Error toggling star: ' + data.error);
        }
      })
      .catch(console.error);
    });
  });
});
function getCookie(name) {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, value] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}
