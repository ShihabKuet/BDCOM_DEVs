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
    list.innerHTML = notices.map(n => `
        <li data-id="${n.id}">
            <span class="notice-content">${n.content}</span>
            <button class="edit-btn">✏️</button>
            <button class="delete-btn">🗑️</button>
        </li>
    `).join('');

    // Attach delete handlers
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.closest('li').dataset.id;
            if (confirm('Delete this notice?')) {
                await fetch(`/notices/${id}`, { method: 'DELETE' });
                loadNotices();
            }
        });
    });

    // Attach edit handlers
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const li = e.target.closest('li');
            const id = li.dataset.id;
            const span = li.querySelector('.notice-content');
            const current = span.innerText;
            const updated = prompt('Edit notice:', current);
            if (updated !== null && updated.trim() !== '') {
                await fetch(`/notices/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content: updated.trim() })
                });
                loadNotices();
            }
        });
    });
}
