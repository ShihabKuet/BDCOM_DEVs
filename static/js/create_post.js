let quill;

// Template content as Quill Delta or HTML
const templateHTML = `
<h3>🛠️ Problem Statement:</h3>
<p>Describe the exact problem in one or two lines.</p>

<h3>📋 Problem Description:</h3>
<p>Explain the issue in detail — when it occurs, frequency, and impact.</p>

<h3>🚩 Reproduction Steps:</h3>
<ol>
  <li>Step 1</li>
  <li>Step 2</li>
  <li>Step 3</li>
</ol>

<h3>🔍 Observed Logs / Behavior:</h3>
<pre><code>// Paste logs or console output here</code></pre>

<h3>📂 Related Code Snippet (if any):</h3>
<pre><code>// Paste relevant code here</code></pre>

<h3>🔎 Root Cause Analysis (if known):</h3>
<p>Explain what you think is causing the problem and why.</p>

<h3>✅ Proposed Solution / Workaround:</h3>
<p>Suggest how it can be fixed, even if it's partial.</p>

<h3>💡 Additional Notes:</h3>
<p>Anything else worth mentioning?</p>
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
    const titleInput = document.getElementById('title');
    const warning = document.getElementById('title-warning');
    const charLimit = 140;

    // Live check: block input beyond 160 characters
    titleInput.addEventListener('input', () => {
        if (titleInput.value.length > charLimit) {
            warning.style.display = 'block';
            titleInput.value = titleInput.value.substring(0, charLimit);
        } else {
            warning.style.display = 'none';
        }
    });

    const quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline'],
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                [{ 'color': [] }, { 'background': [] }],
                ['code', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'indent': '-1' }, { 'indent': '+1' }],
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

        const title = titleInput.value.trim();
        if (title.length > charLimit) {
            warning.style.display = 'block';
            return;
        }
        const type = document.querySelector('input[name="type"]:checked').value;
        const category = document.getElementById('category').value;
        const content = quill.root.innerHTML;
        const reference_id = document.getElementById('referenceSelect').value || null;
        const submitted_by = document.getElementById('username').value;
        const last_modified_by = document.getElementById('username').value;
        const edit_access = document.querySelector('input[name="editAccess"]:checked').value;

        if (!title || !content) {
            alert("Title and content are required.");
            return;
        }

        document.getElementById('hiddenContent').value = content;

        await fetch('/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, type, category, reference_id, submitted_by, last_modified_by, edit_access })
        });

        // alert("Post submitted successfully!");
        window.location.href = "/";
    });
});
