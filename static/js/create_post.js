let quill;

// Template content as Quill Delta or HTML
const templateHTML = `
    <p><strong>Problem Description:</strong></p>
    <p>Write your problem Description here....</p>
    <p><strong>Probable Reason behind:</strong></p>
    <p>If you have any clue about it, you can write it....</p>
`;

function setUsername(name) {
    document.getElementById('username').value = name;
    document.getElementById('username').readOnly = true;
    highlightSelected('yes');

    // Fade out the register hint if visible
    const hint = document.getElementById("register-hint");
    if (hint && hint.style.display !== "none") {
        hint.classList.add("fade-out");
        setTimeout(() => {
            hint.style.display = "none";
            hint.classList.remove("fade-out");
        }, 300); // Match animation duration
    }
}

function enableUsernameField() {
    document.getElementById('username').value = '';
    document.getElementById('username').readOnly = false;
    highlightSelected('no');

    // Show register suggestion
    document.getElementById("register-hint").style.display = "block";
}

function highlightSelected(selected) {
    const yesBtn = document.querySelector('.username-btn.yes');
    const noBtn = document.querySelector('.username-btn.no');

    if (selected === 'yes') {
        yesBtn.classList.add('active');
        noBtn.classList.remove('active');
    } else {
        noBtn.classList.add('active');
        yesBtn.classList.remove('active');
    }
}

function handleUsernameConfirm() {
    const username = document.getElementById('username').value.trim();
    if (!username) {
        alert("Please enter your username.");
        return false;
    }
    return true;
}

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
    const quill = new Quill('#editor-container', {
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

    // Under Development
    // Button click handler to load template
    document.getElementById('loadTemplateBtn').addEventListener('click', () => {
        quill.root.innerHTML = templateHTML;
    });

    // Under Development

    loadReferenceOptions();

    document.getElementById('postForm').addEventListener('submit', async e => {
        e.preventDefault();

        const title = document.getElementById('title').value.trim();
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;
        const content = quill.root.innerHTML;
        const reference_id = document.getElementById('referenceSelect').value || null;
        const submitted_by = document.getElementById('username').value;
        const last_modified_by = document.getElementById('username').value;

        if (!title || !content) {
            alert("Title and content are required.");
            return;
        }

        document.getElementById('hiddenContent').value = content;

        await fetch('/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category, reference_id, submitted_by, last_modified_by })
        });

        // alert("Post submitted successfully!");
        window.location.href = "/";
    });
});
