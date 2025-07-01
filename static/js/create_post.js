let quill;

async function loadReferenceOptions() {
    const res = await fetch('/posts/summary', {
        headers: {
            'Accept': 'application/json'  // ensures server returns JSON
        }
    });
    const posts = await res.json();
    const select = document.getElementById('referenceSelect');
    posts.forEach(post => {
        const option = document.createElement('option');
        option.value = post.id;
        option.textContent = `${post.title} (${post.type})`;
        select.appendChild(option);
    });

    // Initialize Select2
    $('#referenceSelect').select2({
        placeholder: "Search and select a related Query/Patch",
        allowClear: true
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const quill = new Quill('#editor-container', { theme: 'snow' });

    loadReferenceOptions();

    document.getElementById('postForm').addEventListener('submit', async e => {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;
        const content = quill.root.innerHTML;
        const reference_id = document.getElementById('referenceSelect').value || null;

        if (!title || !content) {
            alert("Title and content are required.");
            return;
        }

        document.getElementById('hiddenContent').value = content;

        await fetch('/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category, reference_id })
        });

        // alert("Post submitted successfully!");
        window.location.href = "/";
    });
});
