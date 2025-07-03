document.addEventListener('DOMContentLoaded', () => {
    loadUserIPs();

    document.getElementById('ipForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const ip_address = document.getElementById('ip_address').value.trim();
        const username = document.getElementById('username').value.trim();
        const statusDiv = document.getElementById('statusMessage');

        if (!ip_address || !username) return alert('Both fields are required.');

        // Step 1: Check with confirm_register_ip
        const confirmRes = await fetch('/confirm_register_ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip_address })
        });
        const confirmResult = await confirmRes.json();

        let message;
        if (confirmResult.exists) {
            message = `⚠️ IP ${ip_address} already has username <strong>"${confirmResult.current_username}"</strong>. Do you want to overwrite with <strong>"${username}"</strong>?`;
        } else {
            message = `✅ Do you confirm registering <strong>"${username}"</strong> for IP ${ip_address}?`;
        }

        const proceed = await showConfirmDialog(message);
        if (!proceed) {
            statusDiv.textContent = 'Registration cancelled.';
            statusDiv.style.color = 'gray';
            return;
        }

        // Step 2: Actually register
        const res = await fetch('/register_ip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip_address, username })
        });

        const result = await res.json();

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

function showConfirmDialog(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-box">
                <p>${message}</p>
                <div class="modal-actions">
                    <button id="confirmYes">✅ Yes</button>
                    <button id="confirmNo">❌ No</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#confirmYes').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };
        modal.querySelector('#confirmNo').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };
    });
}

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

