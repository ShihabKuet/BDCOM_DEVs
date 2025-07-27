const messagesContainer = document.getElementById('messages');
const moveTopBtn = document.getElementById('moveTopBtn');

function checkScroll() {
    if (messagesContainer.scrollTop > 100) {
        moveTopBtn.classList.add('show');
    } else {
        moveTopBtn.classList.remove('show');
    }
}

messagesContainer.addEventListener('scroll', checkScroll);

moveTopBtn.addEventListener('click', () => {
    messagesContainer.scrollTo({ top: 0, behavior: 'smooth' });
});
