
document.addEventListener('DOMContentLoaded', () => {
    const chatSearchInput = document.getElementById('chatSearchInput');
    const userCards = document.querySelectorAll('.user-card'); 

    if (chatSearchInput) {
        chatSearchInput.addEventListener('keyup', (event) => {
            const searchText = event.target.value.toLowerCase().trim();

            userCards.forEach(card => {
                const chatName = card.getAttribute('data-search-text'); 

                if (chatName.includes(searchText)) {
                    card.style.display = ''; 
                } else {
                    card.style.display = 'none'; 
                }
            });
        });
    }
});