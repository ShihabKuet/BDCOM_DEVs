document.addEventListener('DOMContentLoaded', () => {
    const quill = new Quill('#editor-container', { theme: 'snow' });

    document.getElementById('postForm').addEventListener('submit', async e => {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;
        const content = quill.root.innerHTML;

        if (!title || !content) {
            alert("Title and content are required.");
            return;
        }

        document.getElementById('hiddenContent').value = content;

        await fetch('/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category })
        });

        alert("Post submitted successfully!");
        window.location.href = "/";
    });
});
