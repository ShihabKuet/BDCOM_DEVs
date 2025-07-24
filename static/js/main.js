function truncate(text, maxLength) {
    return text.length > maxLength
        ? text.substring(0, maxLength).trim() + '... <a href="/posts/' + post.id + '">Read more</a>'
        : text;
}

function getCategoryIcon(category) {
    switch (category.toLowerCase()) {
        case 'vxworks':
            return '🛠️';  // wrench icon
        case 'linux':
            return '🐧';   // penguin icon
        case 'technical':
            return '💡';   // light bulb icon
        case 'non technical':
            return '📖';   // book icon
        default:
            return '📂';   // folder icon fallback
    }
}

function stripHTML(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.innerText = text;
    return div.innerHTML;
}

function renderPaginationControls(currentPage, totalPages, query, category) {
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';

    if (totalPages <= 1) return;

    for (let page = 1; page <= totalPages; page++) {
        const button = document.createElement('button');
        button.textContent = page;
        button.className = page === currentPage ? 'active' : '';
        button.addEventListener('click', () => loadPosts(query, category, page));
        container.appendChild(button);
    }
}

async function loadNotices() {
    const res = await fetch('/notices');
    const notices = await res.json();

    const list = document.getElementById('noticeList');
    list.innerHTML = notices.map(n => `<li>${n.content}</li>`).join('');
}


async function loadPosts(query = '', category = '', page = 1) {
    const container = document.getElementById('postsContainer');
    const loader = document.getElementById('loader');

    // Show loader and hide container
    loader.style.display = 'flex';
    container.style.display = 'none';

    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (category) params.append('category', category);
    params.append('page', page);
    params.append('per_page', 10);

    const url = params.toString() ? `/search?${params.toString()}` : '/posts';

    try {
        const response = await fetch(url);
        const data = await response.json();
        const posts = data.posts;

        if (posts.length === 0) {
            container.innerHTML = `<div class="no-posts">No posts available</div>`;
        } else {
            container.innerHTML = posts.map(post => `
                <div class="card">
                    <div class="post">
                        ${post.pinned ? `<div class="pinned-capsule">📌 Pinned</div>` : ''}
                        <div class="post-header">
                            <h3><a href="/posts/${post.id}">${escapeHtml(post.title)}</a></h3>
                            <span class="post-type ${post.type}">${post.type.toUpperCase()}</span>
                        </div>
                        <div class="post-content">
                            ${
                                stripHTML(post.content).length > 200
                                    ? escapeHtml(stripHTML(post.content).substring(0, 200).trim()) + '... <a href="/posts/' + post.id + '">Read more</a>'
                                    : escapeHtml(stripHTML(post.content))
                            }
                        </div>
                        <div class="post-footer-bar">
                            <div class="post-likes">
                                <button class="like-btn ${post.liked ? 'liked' : ''}" data-id="${post.id}">
                                    🌟 <span id="likes-${post.id}">${post.likes}</span>
                                </button>
                            </div>
                            <div class="post-category-label category-${post.category.toLowerCase().replace(/\s+/g, '-')}" title="${post.category}">
                                ${getCategoryIcon(post.category)} ${post.category}
                            </div>
                        </div>

                        <div class="post-footer">
                            <small><strong>Last modified by:</strong> ${post.last_modified_by}</small>
                            <small><strong>Author:</strong> ${post.submitted_by}</small>
                        </div>
                    </div>
                </div>
            `).join('');            
        }

        renderPaginationControls(data.page, data.total_pages, query, category);

        // Show container after rendering
        container.style.display = 'block';

    } catch (err) {
        console.error('Error loading posts:', err);
        container.innerHTML = '<p style="color:red;">Failed to load posts. Try again later.</p>';
        container.style.display = 'block';
    } finally {
        loader.style.display = 'none';
    }

    // DELETE post
    document.querySelectorAll('.deleteBtn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const postId = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this post?')) {
                await fetch(`/posts/${postId}`, { method: 'DELETE' });
                loadPosts(query, category, page);  // Keep same page
            }
        });
    });

    // EDIT post
    document.querySelectorAll('.editBtn').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.target.getAttribute('data-id');
            const postDiv = e.target.closest('.post');
            const currentTitle = postDiv.querySelector('h3').innerText;
            const currentContent = postDiv.querySelector('.post-content').innerText;
            const currentType = postDiv.querySelector('.post-type').textContent.toLowerCase();

            postDiv.innerHTML = `
                <input type="text" id="editTitle" value="${currentTitle}" style="width: 100%; padding: 5px;"><br><br>
                <textarea id="editContent" style="width: 100%; height: 80px; padding: 5px;">${currentContent}</textarea><br><br>
                <label><input type="radio" name="editType" value="query" ${currentType === 'query' ? 'checked' : ''}> Query</label>
                <label><input type="radio" name="editType" value="patch" ${currentType === 'patch' ? 'checked' : ''}> Patch</label><br><br>
                <button class="saveEditBtn">Save</button>
                <button class="cancelEditBtn">Cancel</button>
            `;

            postDiv.querySelector('.saveEditBtn').addEventListener('click', async () => {
                const title = postDiv.querySelector('#editTitle').value;
                const content = postDiv.querySelector('#editContent').value;
                const type = postDiv.querySelector('input[name="editType"]:checked').value;

                await fetch(`/posts/${postId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title, content, type })
                });

                loadPosts(query, category, page);  // reload with current context
            });

            postDiv.querySelector('.cancelEditBtn').addEventListener('click', () => {
                loadPosts(query, category, page);
            });
        });
    });
}

document.addEventListener("DOMContentLoaded", () => {

    loadNotices();

    const quill = new Quill('#editor-container', {
        theme: 'snow'
    });

    document.getElementById('postForm').addEventListener('submit', async e => {
        e.preventDefault();
        const title = document.getElementById('title').value;

        // Get content from Quill and update hidden input
        const content = quill.root.innerHTML;
        document.getElementById('hiddenContent').value = content;

        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;

        if (title.length > 80) {
            alert("Title must be 160 characters or fewer.");
            return;
        }

        await fetch('/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category })
        });

        document.getElementById('postForm').reset();
        quill.setContents([]);
        loadPosts();
    });


});

document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const query = document.getElementById('searchBox').value.trim();
    const category = document.getElementById('filterCategory') ? document.getElementById('filterCategory').value.trim() : '';
    loadPosts(query, category);
});

// Update filterForm submit event to support search + filter
document.getElementById('filterForm').addEventListener('submit', e => {
    e.preventDefault();
    const category = document.getElementById('filterCategory').value.trim();
    const query = document.getElementById('searchBox') ? document.getElementById('searchBox').value.trim() : '';
    loadPosts(query, category);
});

document.addEventListener('click', async function (e) {
    if (e.target && e.target.classList.contains('like-btn')) {
        const btn = e.target;
        const postId = btn.dataset.id;

        const res = await fetch(`/like/${postId}`, { method: 'POST' });
        const data = await res.json();

        if (res.ok) {
            document.getElementById(`likes-${postId}`).textContent = data.likes;

            if (data.liked) {
                btn.classList.add('liked');
            } else {
                btn.classList.remove('liked');
            }
        } else {
            alert('Error updating like.');
        }
    }
});

loadPosts();
