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

async function loadPosts(query = '') {
    const response = await fetch(query ? `/search?q=${encodeURIComponent(query)}` : '/posts');
    const posts = await response.json();
    const container = document.getElementById('postsContainer');
    container.innerHTML = posts.map(post => `
        <div class="card">
            <div class="post">
                <div class="post-header">
                    <h3><a href="/posts/${post.id}">${post.title}</a></h3>
                    <span class="post-type ${post.type}">${post.type.toUpperCase()}</span>
                </div>
                <p>${
                    stripHTML(post.content).length > 200
                        ? stripHTML(post.content).substring(0, 200).trim() + '... <a href="/posts/' + post.id + '">Read more</a>'
                        : stripHTML(post.content)
                }</p>

                <div class="post-footer-bar">
                    <div class="post-likes">
                        <button class="like-btn ${post.liked ? 'liked' : ''}" data-id="${post.id}">
                            👍 <span id="likes-${post.id}">${post.likes}</span>
                        </button>
                    </div>
                    <div class="post-category-label category-${post.category.toLowerCase().replace(/\s+/g, '-')}" title="${post.category}">
                        ${getCategoryIcon(post.category)} ${post.category}
                    </div>
                </div>

                <div class="post-footer">
                    <small><strong>Last modified by:</strong> ${post.last_modified_ip}</small>
                    <small><strong>Submitted by:</strong> ${post.ip_address}</small>
                </div>
            </div>
        </div>
    `).join('');


    // Attach event listeners for delete buttons
    document.querySelectorAll('.deleteBtn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const postId = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this post?')) {
                await fetch(`/posts/${postId}`, { method: 'DELETE' });
                loadPosts(query);  // reload posts, preserving search query
            }
        });
    });

    // Edit button handling
    document.querySelectorAll('.editBtn').forEach(button => {
        button.addEventListener('click', (e) => {
            const postId = e.target.getAttribute('data-id');
            const postDiv = e.target.closest('.post');
            const currentTitle = postDiv.querySelector('h3').innerText;
            const currentContent = postDiv.querySelector('p').innerText;
            const currentType = postDiv.querySelector('div').className;

            postDiv.innerHTML = `
                <input type="text" id="editTitle" value="${currentTitle}" style="width: 100%; padding: 5px;"><br><br>
                <textarea id="editContent" style="width: 100%; height: 80px; padding: 5px;">${currentContent}</textarea><br><br>
                <label><input type="radio" name="editType" value="problem" ${currentType === 'problem' ? 'checked' : ''}> Problem</label>
                <label><input type="radio" name="editType" value="solution" ${currentType === 'solution' ? 'checked' : ''}> Solution</label><br><br>
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

                loadPosts();
            });

            postDiv.querySelector('.cancelEditBtn').addEventListener('click', () => {
                loadPosts();
            });
        });
    });

}

document.getElementById('filterForm').addEventListener('submit', e => {
    e.preventDefault();
    const category = document.getElementById('filterCategory').value.trim();

    // If you want to combine search + filter, you can extend here.

    if(category) {
        loadPosts('', category);
    } else {
        loadPosts();
    }
});


// Hamburger menu toggle
document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");

    if (hamburger && navMenu) {
        hamburger.addEventListener("click", () => {
            navMenu.classList.toggle("show");
        });
    }

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

    document.getElementById('searchForm').addEventListener('submit', e => {
        e.preventDefault();
        const query = document.getElementById('searchBox').value.trim();
        loadPosts(query);
    });
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
