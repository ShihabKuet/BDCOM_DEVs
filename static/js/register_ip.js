document.addEventListener('DOMContentLoaded', () => {
    loadUserIPs();

    document.getElementById('ipForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const ip_address = document.getElementById('ip_address').value.trim();
        const username = document.getElementById('username').value.trim();

        const res = await fetch('/register_ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip_address, username })
        });

        const result = await res.json();
        const statusDiv = document.getElementById('statusMessage');

        if (res.ok) {
            statusDiv.textContent = result.message;
            statusDiv.style.color = 'green';
            document.getElementById('ipForm').reset();
            loadUserIPs();
        } else {
            statusDiv.textContent = result.error;
            statusDiv.style.color = 'red';
        }
    });

    // 🔍 Search/filter logic
    document.getElementById('searchInput').addEventListener('input', function () {
        const query = this.value.toLowerCase();
        const rows = document.querySelectorAll('#ipTableBody tr');

        rows.forEach(row => {
            const ip = row.cells[1].textContent.toLowerCase();
            const user = row.cells[2].textContent.toLowerCase();
            const match = ip.includes(query) || user.includes(query);
            row.style.display = match ? '' : 'none';
        });
    });
});

async function loadUserIPs() {
    const res = await fetch('/api/user_ips');
    const data = await res.json();

    const tbody = document.getElementById('ipTableBody');
    tbody.innerHTML = data.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.ip}</td>
            <td>${item.username}</td>
        </tr>
    `).join('');
}

