// Show/hide "Move to Top" button
const moveTopBtn = document.getElementById("moveTopBtn");

window.addEventListener("scroll", () => {
    if (document.documentElement.scrollTop > 200) {
        moveTopBtn.classList.add("show");
    } else {
        moveTopBtn.classList.remove("show");
    }
});

moveTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
