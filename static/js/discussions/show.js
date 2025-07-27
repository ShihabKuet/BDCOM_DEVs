// Get discussionId from data attribute
const discussionId = document
  .querySelector('.discussion-container')
  .dataset.discussionId;

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

let scrollToBottom = true;
async function loadMessages(scrollToBottom) {
    const res = await fetch(`/discussions/${discussionId}/messages`);
    const msgs = await res.json();
    const container = document.getElementById('messages');
    container.innerHTML = msgs.map(m => `
        <div class="message">
            <div class="meta">
                <strong>${m.author_name}</strong> &middot; <small>${m.created_at}</small>
            </div>
            <div class="message-body">${escapeHtml(m.content)}</div>
        </div>
    `).join('');

    if (scrollToBottom) {
        container.scrollTop = container.scrollHeight;
    }
}
loadMessages(true);
setInterval(loadMessages, 10000);  // polling - 10 seconds

document.getElementById('messageForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('messageContent').value.trim();
    if (!content) return;
    const res = await fetch(`/discussions/${discussionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({ content })
    });
    if (res.ok) {
        document.getElementById('messageForm').reset();
        loadMessages(true);  // Force scroll to bottom after new message
    }
});

async function changeStatus(newStatus) {
    let message;
    if (newStatus === 'Archived') {
        message = "You won't be able to reopen this discussion once you archive it. Only archive it when you find this discussion will be useful in future.\n\nNow change status to Archived?";
    } else {
        message = `Change status to ${newStatus}?`;
    }

    const confirmed = await customConfirm(message, "Change Status");
    if (!confirmed) return;

    const res = await fetch(`/discussions/${discussionId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
        location.reload();
    } else {
        alert("Failed to change status");
    }
}

async function deleteDiscussion() {
    const confirmed = await customConfirm("Delete this discussion permanently? After that you won't be able to recover it!", "Delete Discussion");
    if (!confirmed) return;

    const res = await fetch(`/discussions/${discussionId}`, { method: 'DELETE' });
    if (res.ok) {
        window.location.href = '/discussions';
    } else {
        alert("Failed to delete discussion");
    }
}


function customConfirm(message, title = "Are you sure?") {
    return new Promise((resolve) => {
        const alertOverlay = document.getElementById("customAlert");
        const alertTitle = document.getElementById("alertTitle");
        const alertMessage = document.getElementById("alertMessage");
        const alertOk = document.getElementById("alertOk");
        const alertCancel = document.getElementById("alertCancel");

        alertTitle.innerText = title;
        alertMessage.innerText = message;
        alertOverlay.style.display = "flex";

        const cleanup = () => {
            alertOverlay.style.display = "none";
            alertOk.removeEventListener("click", onOk);
            alertCancel.removeEventListener("click", onCancel);
        };

        const onOk = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };

        alertOk.addEventListener("click", onOk);
        alertCancel.addEventListener("click", onCancel);
    });
}

