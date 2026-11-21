function openPhotoModal(src, title, desc) {
    const modal = document.getElementById("photo-modal");
    if (!modal) return;
    document.getElementById("modal-photo-img").src = src;
    document.getElementById("modal-photo-title").textContent = title;
    document.getElementById("modal-photo-desc").textContent = desc;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
}

function closePhotoModal() {
    const modal = document.getElementById("photo-modal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.classList.remove("flex");
}