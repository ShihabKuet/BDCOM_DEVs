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

    await fetch(`/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type, category })
    });

    location.reload();
}

async function deletePost(postId) {
    if (confirm('Are you sure you want to delete this post?')) {
        await fetch(`/posts/${postId}`, { method: 'DELETE' });
        window.location.href = '/';  // or reload the list
    }
}

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
});
