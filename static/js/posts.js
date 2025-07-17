let editQuill;  // Declare once at the top

function showTopAlert(message, type = 'success', duration = 3000) {
    const alertEl = document.getElementById('topAlert');
    alertEl.className = `alert-box alert-${type} show`;
    alertEl.innerHTML = message;

    setTimeout(() => {
        alertEl.classList.remove('show');
    }, duration);
}

function startEdit() {
    document.getElementById('editForm').style.display = 'block';
}

function cancelEdit() {
    document.getElementById('editForm').style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

async function submitEdit(e, postId) {
    e.preventDefault();

    const title = document.getElementById('editTitle').value;
    const content = editQuill.root.innerHTML;
    const type = document.querySelector('input[name="editType"]:checked').value;
    const category = document.getElementById('editCategory').value;
    const last_modified_by = document.getElementById('editUsername').value;

    try {
        const response = await fetch(`/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category, last_modified_by })
        });

        const data = await response.json();

        if (data.message === 'Nothing is modified') {
            showTopAlert("⚠️ No changes detected.", "warning");
        } else {
            showTopAlert("✅ Post updated successfully.", "success");

            document.getElementById('editForm').style.display = 'none';
            // Delay reload to let user see success message
            setTimeout(() => location.reload(), 1000);
        }
    } catch (error) {
        console.error(error);
        showTopAlert("❌ Failed to update post.", "error");
    }
}


/* Delete Post */
let pendingDeletePostId = null;

async function deletePost(postId) {
    pendingDeletePostId = postId;
    document.getElementById('deleteModal').style.display = 'flex';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (pendingDeletePostId !== null) {
        // await fetch(`/posts/${pendingDeletePostId}`, { method: 'DELETE' });
        await fetch(`/posts/${pendingDeletePostId}/soft_delete`, { method: 'PATCH' });
        window.location.href = '/';
    }
});

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeletePostId = null;
});
/* Delete post ends*/

const COMMENT_PREVIEW_LENGTH = 150;  // Adjust as needed

async function loadComments(postId) {
    const res = await fetch(`/comments/${postId}`);
    const comments = await res.json();
    const userIP = await (await fetch('/my-ip')).json();

    const container = document.getElementById('comments-container');
    container.innerHTML = comments.map((c, index) => {
        const isLong = c.content.length > COMMENT_PREVIEW_LENGTH;
        const previewText = isLong ? escapeHtml(c.content.substring(0, COMMENT_PREVIEW_LENGTH)) : escapeHtml(c.content);
        const fullText = escapeHtml(c.content);

        return `
        <div class="comment" data-id="${index}">
            <p class="comment-content" id="comment-content-${index}">
                ${previewText}${isLong ? `<span id="ellipsis-${index}">…</span>` : ''}
                <span id="full-text-${index}" style="display:none;">${fullText.substring(COMMENT_PREVIEW_LENGTH)}</span>
                ${isLong ? `<a href="#" id="toggle-btn-${index}" class="expand-link">Expand</a>` : ''}
            </p>
            <small>By <strong>${c.commented_by}</strong> at ${c.timestamp}</small>
            ${c.ip_address === userIP.ip ? `
                <div class="comment-actions">
                    <button onclick="startEditComment(${index}, ${postId})">✏️</button>
                    <button onclick="deleteComment(${index}, ${postId})">🗑️</button>
                </div>
                <div id="edit-comment-${index}" class="edit-comment-box">
                    <textarea id="edit-text-${index}" class="edit-comment-text" required>${c.content}</textarea>
                    <div class="edit-comment-actions">
                        <button type="button" class="save-btn" onclick="submitCommentEdit(event, ${index}, ${postId})">💾 Save</button>
                        <button type="button" class="cancel-btn" onclick="cancelEditComment(${index})">✖ Cancel</button>
                    </div>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');

    // Add toggle event listeners after rendering
    comments.forEach((_, index) => {
        const toggleBtn = document.getElementById(`toggle-btn-${index}`);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                toggleCommentExpand(index);
            });
        }
    });
}

function toggleCommentExpand(index) {
    const ellipsis = document.getElementById(`ellipsis-${index}`);
    const fullText = document.getElementById(`full-text-${index}`);
    const toggleBtn = document.getElementById(`toggle-btn-${index}`);

    if (fullText.style.display === 'none') {
        // Expand
        fullText.style.display = 'inline';
        ellipsis.style.display = 'none';
        toggleBtn.innerHTML = `Collapse <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        toggleBtn.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
    } else {
        // Collapse
        fullText.style.display = 'none';
        ellipsis.style.display = 'inline';
        toggleBtn.innerHTML = `Expand <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        toggleBtn.classList.remove('expanded');
        toggleBtn.classList.add('collapsed');
    }
}


async function deleteComment(index, postId) {
    const commentId = await getCommentIdByIndex(postId, index);
    if (!confirm('Delete this comment?')) return;

    await fetch(`/comments/${commentId}`, { method: 'DELETE' });
    loadComments(postId);
}

function startEditComment(index, postId) {
    const box = document.getElementById(`edit-comment-${index}`);
    box.classList.add('visible');
    document.getElementById(`edit-text-${index}`).focus();
}

function cancelEditComment(index) {
    const box = document.getElementById(`edit-comment-${index}`);
    box.classList.remove('visible');
}

function setEditUsername(name) {
    document.getElementById('editUsername').value = name;
    document.getElementById('editUsername').readOnly = true;
    document.getElementById('editUsername').style.backgroundColor = '#f0f0f0';
    document.querySelector('#edit-username-confirm-section .yes').classList.add('active');
    document.querySelector('#edit-username-confirm-section .no').classList.remove('active');
}

function enableEditUsernameField() {
    const input = document.getElementById('editUsername');
    input.readOnly = false;
    input.value = '';
    input.focus();
    input.style.backgroundColor = '#ffffff';

    // Show register suggestion
    document.getElementById("register-hint").style.display = "block";
    
    document.querySelector('#edit-username-confirm-section .yes').classList.remove('active');
    document.querySelector('#edit-username-confirm-section .no').classList.add('active');
}


async function submitCommentEdit(e, index, postId) {
    e.preventDefault();
    const content = document.getElementById(`edit-text-${index}`).value;
    const commentId = await getCommentIdByIndex(postId, index);

    await fetch(`/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });

    loadComments(postId);
}

async function getCommentIdByIndex(postId, index) {
    const res = await fetch(`/comments/${postId}`);
    const comments = await res.json();
    return comments[index].id;  // you'll need to return `id` from backend!
}

document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('commentContent').value;
    const postId = window.location.pathname.split('/').pop();

    const res = await fetch(`/comments/${postId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });

    if (res.ok) {
        document.getElementById('commentForm').reset();
        loadComments(postId);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const postId = window.location.pathname.split('/').pop();
    loadComments(postId);

    // ✅ Initialize Quill editor after DOM is ready
    editQuill = new Quill('#edit-quill-container', {
        theme: 'snow',
        modules: {
            toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, false] }],
            ['code', 'code-block'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'],  // ← image button
            ['clean']
            ]
        }
    });

    // ✅ Set existing content into Quill
    const contentHTML = document.getElementById('editContentRaw')?.innerHTML;
    if (contentHTML) {
        editQuill.root.innerHTML = contentHTML;
    }

    // Title length warning
    const editTitleInput = document.getElementById("editTitle");
    const titleWarning = document.getElementById("title-warning");

    if (editTitleInput && titleWarning) {
        editTitleInput.addEventListener("input", () => {
            if (editTitleInput.value.length > 140) {
                titleWarning.style.display = "block";
                editTitleInput.value = editTitleInput.value.slice(0, 140); // truncate
            } else {
                titleWarning.style.display = "none";
            }
        });
    }    

    // Show Edit History
    const showHistoryBtn = document.getElementById('showHistoryBtn');
    if (showHistoryBtn) {
        showHistoryBtn.addEventListener('click', async () => {
            const container = document.getElementById('historyContainer');
            const postId = window.currentPostId || window.location.pathname.split('/').pop();

            try {
                const res = await fetch(`/posts/${postId}/history`);
                const history = await res.json();;

                if (history.length === 0) {
                    container.innerHTML = '<p>No edit history available.</p>';
                } else {
                    container.innerHTML = history.map((h, i) => `
                        <div class="history-entry">
                        <div class="history-meta">
                            <div class="meta-block">
                            <span class="meta-icon">✍️</span>
                            <span class="meta-label">${i === history.length - 1 ? 'Created by:' : 'Edited by:'}</span>
                            <span class="meta-value">${h.edited_by}</span>
                            </div>
                            <div class="meta-block">
                            <span class="meta-icon">🕒</span>
                            <span class="meta-label">${i === history.length - 1 ? 'Created at:' : 'Edited at:'}</span>
                            <span class="meta-value">${h.edited_at}</span>
                            </div>
                            <div class="meta-block">
                            <span class="meta-icon">🧩</span>
                            <span class="meta-label">Type:</span>
                            <span class="meta-value">${h.type.toUpperCase()}</span>
                            </div>
                            <div class="meta-block">
                            <span class="meta-icon">📁</span>
                            <span class="meta-label">Category:</span>
                            <span class="meta-value">${h.category.toUpperCase()}</span>
                            </div>
                        </div>

                        <h3 class="history-title">Title: ${h.title}</h3>
                        <div class="history-content">
                           ${h.content}
                        </div>

                        </div>
                    `).join('');
                }

                container.style.display = 'block';
                container.scrollIntoView({ behavior: 'smooth' });  // 👈 scrolls down smoothly
            } catch (error) {
                container.innerHTML = '<p>Error loading history.</p>';
                container.scrollIntoView({ behavior: 'smooth' });  // also scroll on error
            }
        });
    }

    // Load similar posts
    fetch(`/similar-posts/${postId}`)
    .then(res => res.json())
    .then(data => {
        const container = document.getElementById('similar-posts-list');
        if (data.length === 0) {
            container.innerHTML = "<p>No similar posts found.</p>";
            return;
        }

        container.innerHTML = data.map(post => `
            <div class="similar-post-item">
                <a href="/posts/${post.id}">${post.title}</a>
                <small>by <strong>${post.submitted_by}</strong></small>
            </div>
        `).join('');
    }); 
});