function editPostField(postId, field, value) {
    fetch(`/posts/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
    }).then(res => {
        if (!res.ok) alert("Failed to update post.");
    });
}

function deletePost(postId) {
    if (!confirm("Are you sure to delete post #" + postId + "?")) return;
    fetch(`/posts/${postId}`, {
        method: 'DELETE'
    }).then(res => {
        if (res.ok) {
            document.getElementById(`post-row-${postId}`).remove();
        } else {
            alert("Failed to delete.");
        }
    });
}
