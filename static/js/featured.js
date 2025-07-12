

document.addEventListener('DOMContentLoaded', async () => {
    const featuredList = document.getElementById('featuredPostsList');
    try {
        const res = await fetch('/api/featured_posts');
        const featured = await res.json();
        if (featured.length === 0) {
            featuredList.innerHTML = "<li>No featured posts yet.</li>";
        } else {
            featuredList.innerHTML = featured.map(f => `
                <li><a href="${f.link}">${f.title}</a></li>
            `).join('');
        }
    } catch (err) {
        console.error("Error loading featured posts", err);
    }
});
