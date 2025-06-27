function truncate(text, maxLength) {
    return text.length > maxLength
        ? text.substring(0, maxLength).trim() + '... <a href="/posts/' + post.id + '">Read more</a>'
        : text;
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
                    post.content.length > 200 
                        ? post.content.substring(0, 200).trim() + '... <a href="/posts/' + post.id + '">Read more</a>'
                        : post.content
                }</p>
                <small style="color: #666;">This post has been submitted by <strong>${post.ip_address}</strong></small>
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

document.getElementById('postForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const type = document.querySelector('input[name="type"]:checked').value;

    if (title.length > 80) {
        alert("Title must be 160 characters or fewer.");
        return;
    }

    await fetch('/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, type })
    });

    document.getElementById('postForm').reset();
    loadPosts();
});

document.getElementById('searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const query = document.getElementById('searchBox').value.trim();
    loadPosts(query);
});

loadPosts();
