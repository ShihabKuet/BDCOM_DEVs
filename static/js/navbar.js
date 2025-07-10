document.addEventListener('DOMContentLoaded', function () {
    const bell = document.getElementById('notificationBell');
    const dropdown = document.getElementById('notificationDropdown');
    const badge = document.getElementById('unreadCount');

    async function fetchNotifications(showToast = false) {
        try {
            const res = await fetch('/notifications');
            const data = await res.json();
            const unread = data.filter(n => !n.is_read);

            // Update badge
            if (unread.length > 0) {
                badge.textContent = unread.length;
                badge.style.display = 'inline-block';
            } else {
                badge.textContent = '';
                badge.style.display = 'none';
            }

            // Update dropdown
            if (data.length === 0) {
                dropdown.innerHTML = `<div class="notification-item">No notifications</div>`;
            } else {
                dropdown.innerHTML = data.map(n => `
                    <div class="notification-item ${n.is_read ? '' : 'unread'}">
                        ${n.related_post_id ? `<a href="/posts/${n.related_post_id}">${n.message}</a>` : n.message}
                        <br><small>${n.timestamp}</small>
                    </div>
                `).join('');
            }

            // Show toast for new unread notifications (optional)
            if (showToast && unread.length > 0) {
                unread.forEach(n => {
                    if (!n.notified) {
                        showToast(n.message);
                    }
                });
            }

        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    // Toggle dropdown & mark all as read
    bell.addEventListener('click', async () => {
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            await fetch('/notifications/mark_all_read', { method: 'POST' });
            fetchNotifications(); // Refresh after marking read
        }
    });

    // Close dropdown if clicking outside
    document.addEventListener('click', (e) => {
        if (!bell.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Polling every 60 seconds
    setInterval(() => fetchNotifications(true), 60000);

    // Initial fetch
    fetchNotifications();
});
