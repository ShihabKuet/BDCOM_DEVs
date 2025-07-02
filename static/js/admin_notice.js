document.addEventListener('DOMContentLoaded', () => {
    loadNotices();

    document.getElementById('noticeForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const content = document.getElementById('noticeContent').value;

        const res = await fetch('/notices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });

        if (res.ok) {
            document.getElementById('noticeForm').reset();
            loadNotices();
        } else {
            alert('Failed to send notice.');
        }
    });
});

async function loadNotices() {
    const res = await fetch('/notices');
    const notices = await res.json();

    const list = document.getElementById('noticeList');
    list.innerHTML = notices.map(n => `<li>${n.content}</li>`).join('');
}
