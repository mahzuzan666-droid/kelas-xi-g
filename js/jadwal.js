document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("filter-mapel");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const keyword = e.target.value.toLowerCase().trim();
        document.querySelectorAll(".mapel-item").forEach((item) => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(keyword) ? "" : "none";
        });
    });
});