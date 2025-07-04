let editQuill;  // Declare once at the top

function startEdit() {
    document.getElementById('editForm').style.display = 'block';
}

function cancelEdit() {
    document.getElementById('editForm').style.display = 'none';
}

async function submitEdit(e, postId) {
    e.preventDefault();
    const title = document.getElementById('editTitle').value;
    const content = editQuill.root.innerHTML;
    const type = document.querySelector('input[name="editType"]:checked').value;
    const category = document.getElementById('editCategory').value;
    const last_modified_by = document.getElementById('editUsername').value;

    await fetch(`/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type, category, last_modified_by })
    });

    location.reload();
}

/* Delete Post */
let pendingDeletePostId = null;

async function deletePost(postId) {
    pendingDeletePostId = postId;
    document.getElementById('deleteModal').style.display = 'flex';
}

document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (pendingDeletePostId !== null) {
        await fetch(`/posts/${pendingDeletePostId}`, { method: 'DELETE' });
        window.location.href = '/';
    }
});

document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
    document.getElementById('deleteModal').style.display = 'none';
    pendingDeletePostId = null;
});
/* Delete post ends*/

async function loadComments(postId) {
    const res = await fetch(`/comments/${postId}`);
    const comments = await res.json();
    const userIP = await (await fetch('/my-ip')).json();

    const container = document.getElementById('comments-container');
    container.innerHTML = comments.map((c, index) => `
        <div class="comment" data-id="${index}">
            <p class="comment-content">${c.content}</p>
            <small>By <strong>${c.commented_by}</strong> at ${c.timestamp}</small>
            ${c.ip_address === userIP.ip ? `
                <div class="comment-actions">
                    <button onclick="startEditComment(${index}, '${c.content.replace(/'/g, "\\'")}', ${postId})">✏️</button>
                    <button onclick="deleteComment(${index}, ${postId})">🗑️</button>
                </div>
                <form id="edit-comment-${index}" style="display:none;" onsubmit="submitCommentEdit(event, ${index}, ${postId})">
                    <textarea id="edit-text-${index}" required>${c.content}</textarea>
                    <button type="submit">Save</button>
                    <button type="button" onclick="cancelEditComment(${index})">Cancel</button>
                </form>
            ` : ''}
        </div>
    `).join('');
}

async function deleteComment(index, postId) {
    const commentId = await getCommentIdByIndex(postId, index);
    if (!confirm('Delete this comment?')) return;

    await fetch(`/comments/${commentId}`, { method: 'DELETE' });
    loadComments(postId);
}

function startEditComment(index, content, postId) {
    document.getElementById(`edit-comment-${index}`).style.display = 'block';
}

function cancelEditComment(index) {
    document.getElementById(`edit-comment-${index}`).style.display = 'none';
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
