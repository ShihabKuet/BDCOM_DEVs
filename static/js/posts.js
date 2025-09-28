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
    const edit_access = document.querySelector('input[name="editEditAccess"]:checked').value;

    try {
        const response = await fetch(`/posts/${postId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category, last_modified_by, edit_access })
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

const COMMENTS_PER_BATCH = 5;
let allComments = [];

async function loadComments(postId) {
    const container = document.getElementById('comments-container');
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loader = document.getElementById('comments-loader');

    // Show loader, hide old comments + button
    loader.style.display = 'block';
    container.innerHTML = '';
    loadMoreBtn.style.display = 'none';

    try {
        const res = await fetch(`/comments/${postId}`);
        allComments = await res.json(); // already nested structure
        const userIP = await (await fetch('/my-ip')).json();

        // Hide loader
        loader.style.display = 'none';

        // Render first batch of top-level comments
        renderCommentBatch(postId, 0, COMMENTS_PER_BATCH, userIP);

        // Show/hide "Load More"
        loadMoreBtn.style.display = allComments.length > COMMENTS_PER_BATCH ? 'block' : 'none';
        loadMoreBtn.dataset.batch = COMMENTS_PER_BATCH;
    } catch (error) {
        loader.innerHTML = '<p class="error">❌ Failed to load comments. Please try again.</p>';
        console.error('Error loading comments:', error);
    }
}

function renderCommentBatch(postId, start, end, userIP) {
    const container = document.getElementById('comments-container');
    const fragment = document.createDocumentFragment();

    for (let i = start; i < end && i < allComments.length; i++) {
        renderComment(allComments[i], fragment, userIP, postId, 0, i);
    }

    container.appendChild(fragment);

    // Hide "Load More" if done
    if (end >= allComments.length) {
        document.getElementById('load-more-btn').style.display = 'none';
    }
}

// Keep track of replies open state globally
const replyVisibilityState = {};

function renderComment(c, container, userIP, postId, depth, index) {
    const COMMENT_MAX_DEPTH = 3; // maximum indentation
    const actual_comment_depth = Math.min(depth, COMMENT_MAX_DEPTH);

    const isLong = c.content.length > COMMENT_PREVIEW_LENGTH;
    const previewText = isLong ? escapeHtml(c.content.substring(0, COMMENT_PREVIEW_LENGTH)) : escapeHtml(c.content);
    const fullText = escapeHtml(c.content);

    const imageHTML = c.image_path
        ? `<div class="comment-image-container">
             <img src="${c.image_path}" class="comment-image" loading="lazy" data-full="${c.image_path}" />
           </div>` : '';

    const commentEl = document.createElement('div');
    commentEl.className = 'comment';
    commentEl.style.marginLeft = `${actual_comment_depth * 5}px`; // indent replies
    if (depth > 3) {
        commentEl.style.marginLeft = `${-14}px`;
    }
    commentEl.dataset.id = index;

    commentEl.innerHTML = `
        <div class="comment-content">
            ${imageHTML}
            <span id="preview-text-${c.id}">${previewText}${isLong ? `<span id="ellipsis-${c.id}">....</span>` : ''}</span>
            <span id="full-text-${c.id}" style="display:none;">${fullText}</span>
            ${isLong ? `
                <a href="#" id="toggle-btn-${c.id}" class="expand-link">
                    <span class="label">Expand</span>
                    <span class="icon">▼</span>
                </a>` : ''}
        </div>
        <small>By <strong>${c.commented_by}</strong> at ${c.timestamp}</small>
    <div class="comment-actions">
        <button class="reply-btn" data-id="${c.id}">↩ Reply</button>
        ${c.ip_address === userIP.ip ? `
            <button onclick="startEditComment(${c.id}, ${postId})">✏️ Edit</button>
            <button onclick="openCommentDeleteModal(${c.id}, ${postId})">🗑️ Delete</button>
        ` : ''}
    </div>

    ${c.ip_address === userIP.ip ? `
        <div id="edit-comment-${c.id}" class="edit-comment-box">
            <textarea id="edit-text-${c.id}" class="edit-comment-text" required>${c.content}</textarea>
            <div class="edit-comment-actions">
                <button type="button" class="save-btn" onclick="submitCommentEdit(event, ${c.id}, ${postId})">💾 Save</button>
                <button type="button" class="cancel-btn" onclick="cancelEditComment(${c.id})">✖ Cancel</button>
            </div>
        </div>` : ''}
        <div id="replies-${c.id}"></div>

        <div id="replies-${c.id}" class="replies"></div>
        ${c.replies.length > 0 ? `<button class="show-replies-btn" id="show-replies-${c.id}">
            Show replies (${c.replies.length})
        </button>` : ''}
    `;
    container.appendChild(commentEl);

    // Reply form button
    commentEl.querySelector('.reply-btn').addEventListener('click', () => {
        showReplyForm(commentEl, c.id, postId);
    });

    // Expand/collapse
    const toggleBtn = commentEl.querySelector(`#toggle-btn-${c.id}`);
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault();

            const previewText = commentEl.querySelector(`#preview-text-${c.id}`);
            const fullText = commentEl.querySelector(`#full-text-${c.id}`);
            const ellipsis = previewText.querySelector(`#ellipsis-${c.id}`);
            const label = toggleBtn.querySelector('.label');
            const icon = toggleBtn.querySelector('.icon');

            if (fullText.style.display === 'none') {
                // Expand
                previewText.style.display = 'none';
                if (ellipsis) ellipsis.style.display = 'none';
                fullText.style.display = 'inline';
                label.textContent = 'Collapse';
                icon.textContent = '▲';
            } else {
                previewText.style.display = 'inline';
                if (ellipsis) ellipsis.style.display = 'inline';
                fullText.style.display = 'none';
                label.textContent = 'Expand';
                icon.textContent = '▼';
            }
        });
    }

    // Lazy load replies on button click
    const showRepliesBtn = commentEl.querySelector(`#show-replies-${c.id}`);
    if (showRepliesBtn) {
        const repliesContainer = commentEl.querySelector(`#replies-${c.id}`);
        let repliesLoaded = false;

        // Restore previous state if exists
        if (replyVisibilityState[c.id]) {
            c.replies.forEach((reply, idx) =>
                renderComment(reply, repliesContainer, userIP, postId, depth + 1, `${index}-${idx}`)
            );
            repliesLoaded = true;
            repliesContainer.style.display = 'block';
            showRepliesBtn.textContent = `Hide replies (${c.replies.length})`;
        }

        showRepliesBtn.addEventListener('click', () => {
            if (!repliesLoaded) {
                // First time load: render replies
                c.replies.forEach((reply, idx) =>
                    renderComment(reply, repliesContainer, userIP, postId, depth + 1, `${index}-${idx}`)
                );
                repliesLoaded = true;
            }

            // Toggle visibility and save state
            const isVisible = repliesContainer.style.display === 'block';
            if (isVisible) {
                repliesContainer.style.display = 'none';
                showRepliesBtn.textContent = `Show replies (${c.replies.length})`;
                replyVisibilityState[c.id] = false;
            } else {
                repliesContainer.style.display = 'block';
                showRepliesBtn.textContent = `Hide replies (${c.replies.length})`;
                replyVisibilityState[c.id] = true;
            }
        });
    }

}

/**
 * Inline reply form handler
 */
function showReplyForm(commentDiv, parentId, postId) {
    // Remove any open reply form before creating new
    const existing = commentDiv.querySelector('.reply-form');
    if (existing) existing.remove();

    const form = document.createElement('div');
    form.className = 'reply-form';
    form.innerHTML = `
        <textarea class="replyContent" placeholder="Write a reply..." required></textarea>
        
        <div class="reply-upload-wrapper">
            <input type="file" id="replyImage" class="replyImage" accept="image/*">
            <label for="replyImage" class="replyImageLabel">
                📷 Upload Image
            </label>
            <span id="replyImageName" class="replyImageName"></span>
        </div>

        <div>
            <button class="sendReplyBtn">Reply</button>
            <button class="cancelReplyBtn">Cancel</button>
        </div>
    `;
    commentDiv.appendChild(form);

    const textarea = form.querySelector('.replyContent');
    const imageInput = form.querySelector('.replyImage');
    textarea.focus();

    form.querySelector('.sendReplyBtn').addEventListener('click', async () => {
        const content = textarea.value.trim();
        if (!content && !imageInput.files.length) return;

        const formData = new FormData();
        formData.append('content', content);
        formData.append('parent_id', parentId);
 
        if (imageInput.files.length > 0) {
            formData.append('image', imageInput.files[0]); // append selected image
        }

        await fetch(`/comments/${postId}`, { method: 'POST', body: formData });
        loadComments(postId);
    });

    form.querySelector('.cancelReplyBtn').addEventListener('click', () => {
        form.remove();
    });
}

document.addEventListener('change', (e) => {
    if (e.target.classList.contains('replyImage')) {
        const fileNameSpan = document.getElementById('replyImageName');
        fileNameSpan.textContent = e.target.files.length > 0 ? e.target.files[0].name : '';
    }
});

document.getElementById('load-more-btn').addEventListener('click', () => {
    const loader = document.getElementById('comments-loader');
    loader.style.display = 'block';

    const postId = window.location.pathname.split('/').pop();
    const start = parseInt(document.getElementById('load-more-btn').dataset.batch);
    const end = start + COMMENTS_PER_BATCH;
    document.getElementById('load-more-btn').dataset.batch = end;

    fetch('/my-ip')
        .then(res => res.json())
        .then(userIP => {
            renderCommentBatch(postId, start, end, userIP);

            loader.style.display = 'none'; // hide loader after batch render

            if (end >= allComments.length) {
                document.getElementById('load-more-btn').style.display = 'none';
            }
        });
});


function toggleCommentExpand(index) {
    //const ellipsis = document.getElementById(`ellipsis-${index}`);
    const fullText = document.getElementById(`full-text-${index}`);
    const toggleBtn = document.getElementById(`toggle-btn-${index}`);
    const previewText = document.getElementById(`preview-text-${index}`);

    if (fullText.style.display === 'none') {
        // Expand
        previewText.style.display = 'none';
        //ellipsis.style.display = 'none';
        fullText.style.display = 'inline';
        toggleBtn.innerHTML = `Collapse <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        toggleBtn.classList.remove('collapsed');
        toggleBtn.classList.add('expanded');
    } else {
        // Collapse
        previewText.style.display = 'inline';
        fullText.style.display = 'none';
        //ellipsis.style.display = 'inline';
        toggleBtn.innerHTML = `Expand <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>`;
        toggleBtn.classList.remove('expanded');
        toggleBtn.classList.add('collapsed');
    }
}

// Comment Deletion Confirmarion Box
let commentToDelete = null;
let postForCommentDelete = null;

function openCommentDeleteModal(commentId, postId) {
    commentToDelete = commentId;
    postForCommentDelete = postId;
    document.getElementById('commentDeleteModal').style.display = 'flex';
}

// Close modal without deleting
document.getElementById('cancelCommentDeleteBtn').addEventListener('click', () => {
    document.getElementById('commentDeleteModal').style.display = 'none';
    commentToDelete = null;
    postForCommentDelete = null;
});

// Confirm delete
document.getElementById('confirmCommentDeleteBtn').addEventListener('click', () => {
    if (commentToDelete && postForCommentDelete) {
        deleteComment(commentToDelete, postForCommentDelete);
    }
    document.getElementById('commentDeleteModal').style.display = 'none';
    commentToDelete = null;
    postForCommentDelete = null;
});


async function deleteComment(commentId, postId) {
    await fetch(`/comments/${commentId}`, { method: 'DELETE' });
    loadComments(postId);
}

function startEditComment(commentId) {
    const box = document.getElementById(`edit-comment-${commentId}`);
    box.classList.add('visible');
    document.getElementById(`edit-text-${commentId}`).focus();
}

function cancelEditComment(commentId) {
    const box = document.getElementById(`edit-comment-${commentId}`);
    box.classList.remove('visible');
}

// async function deleteComment(index, postId) {
//     const commentId = await getCommentIdByIndex(postId, index);
//     if (!confirm('Delete this comment?')) return;

//     await fetch(`/comments/${commentId}`, { method: 'DELETE' });
//     loadComments(postId);
// }

// function startEditComment(index, postId) {
//     const box = document.getElementById(`edit-comment-${index}`);
//     box.classList.add('visible');
//     document.getElementById(`edit-text-${index}`).focus();
// }

// function cancelEditComment(index) {
//     const box = document.getElementById(`edit-comment-${index}`);
//     box.classList.remove('visible');
// }

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

async function submitCommentEdit(e, commentId, postId) {
    e.preventDefault();
    const content = document.getElementById(`edit-text-${commentId}`).value.trim();
    if (!content) {
        showTopAlert("⚠️ Comment cannot be empty.", "warning");
        return;
    }
    await fetch(`/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
    });
    loadComments(postId);
}

// async function submitCommentEdit(e, index, postId) {
//     e.preventDefault();
//     const content = document.getElementById(`edit-text-${index}`).value.trim();
//     if (content === '') {
//         showTopAlert("⚠️ Comment cannot be empty or just spaces.", "warning");
//         return;
//     }
//     const commentId = await getCommentIdByIndex(postId, index);

//     await fetch(`/comments/${commentId}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ content })
//     });

//     loadComments(postId);
// }

// ager comment eta.
// async function getCommentIdByIndex(postId, index) {
//     const res = await fetch(`/comments/${postId}`);
//     const comments = await res.json();
//     return comments[index].id;  // you'll need to return `id` from backend!
// }

async function getCommentIdByIndex(postId, index) {
    // use global allComments to avoid mismatches
    return allComments[index].id;
}


document.getElementById('commentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const content = document.getElementById('commentContent').value.trim(); // Trim whitespace
    if (content === '') {
        showTopAlert("⚠️ Comment cannot be empty or just spaces.", "warning");
        return;
    }
    const postId = window.location.pathname.split('/').pop();
    const imageInput = document.getElementById('commentImage');

    const formData = new FormData();
    formData.append('content', content);
    if (imageInput.files.length > 0) {
        formData.append('image', imageInput.files[0]);
    }

    const res = await fetch(`/comments/${postId}`, {
        method: 'POST',
        body: formData
    });

    if (res.ok) {
        document.getElementById('commentForm').reset();

        // Reset custom file preview UI (clear filename & thumbnail)
        if (typeof updateUI === 'function') window.updateUI(null);

        loadComments(postId);
        showTopAlert("✅ Feedback added!", "success");
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const postId = window.location.pathname.split('/').pop();
    loadComments(postId);

    // Lightbox elements
    const lightboxOverlay = document.getElementById('lightboxOverlay');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxClose = document.getElementById('lightboxClose');

    // ✅ Initialize Quill editor after DOM is ready
    editQuill = new Quill('#edit-quill-container', {
        theme: 'snow',
        modules: {
            toolbar: [
            ['bold', 'italic', 'underline'],
            [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
            [{ 'color': [] }, { 'background': [] }],
            ['code', 'code-block'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['link', 'image'],  // ← image button
            ['clean']
            ]
        }
    });

    // Light box for Post Images
    document.querySelector('.post-body').addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() === 'img') {
            const src = e.target.src;
            lightboxImage.src = src;
            lightboxOverlay.style.display = 'flex';
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
    
    // Delegate click on comment images to open lightbox
    document.getElementById('comments-container').addEventListener('click', (e) => {
        if (e.target.classList.contains('comment-image')) {
        const src = e.target.getAttribute('data-full');
        if (src) {
            lightboxImage.src = src;
            lightboxOverlay.style.display = 'flex';
        }
        }
    });

    // Close lightbox on overlay or close button click
    lightboxOverlay.addEventListener('click', () => {
        lightboxOverlay.style.display = 'none';
        lightboxImage.src = '';
    });

    lightboxClose.addEventListener('click', () => {
        lightboxOverlay.style.display = 'none';
        lightboxImage.src = '';
    });

    // Also close on pressing Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && lightboxOverlay.style.display === 'flex') {
        lightboxOverlay.style.display = 'none';
        lightboxImage.src = '';
        }
    });

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
                <a href="/posts/${post.id}">${escapeHtml(post.title)}</a>
                <small>by <strong>${post.submitted_by}</strong></small>
            </div>
        `).join('');
    });
});

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

// File input UI behavior
(function() {
  const wrapper = document.getElementById('commentImageWrapper');
  const input = document.getElementById('commentImage');
  const fileNameEl = wrapper.querySelector('.file-name');
  const previewWrap = wrapper.querySelector('.file-preview');
  const previewImg = wrapper.querySelector('.file-preview img');
  const removeBtn = wrapper.querySelector('.file-remove');
  const commentTextarea = document.getElementById('commentContent');

  if (!input) return;

  window.updateUI = function(file) {
    if (!file) {
      fileNameEl.textContent = 'No file chosen';
      previewWrap.style.display = 'none';
      previewImg.src = '';
      removeBtn.style.display = 'none';
      return;
    }

    fileNameEl.textContent = file.name;
    removeBtn.style.display = 'inline-block';

    // Show thumbnail if image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        previewImg.src = reader.result;
        previewWrap.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      previewImg.src = '';
      previewWrap.style.display = 'none';
    }
  }

  // When user selects file through dialog
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    window.updateUI(file);
  });

  // Drag & drop styling
  ['dragenter','dragover'].forEach(evt => {
    wrapper.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.add('dragover');
    });
  });

  ['dragleave','drop'].forEach(evt => {
    wrapper.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
      wrapper.classList.remove('dragover');
    });
  });

  // Handle drop
  wrapper.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    if (!dt) return;
    const file = dt.files[0];
    if (!file) return;
    // set the file to the input (so FormData picks it up)
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    window.updateUI(file);
  });

  // Handle paste inside comment textarea
  commentTextarea.addEventListener('paste', (event) => {
    const items = (event.clipboardData || window.clipboardData).items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        const file = new File([blob], blob.name || 'pasted-image.png', { type: blob.type });

        // Put into file input so it uploads with the form
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;

        // Update UI with preview
        window.updateUI(file);

        break; // only first image
      }
    }
  });

  // Remove / clear file
  removeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    input.value = '';
    window.updateUI(null);
  });
})();
