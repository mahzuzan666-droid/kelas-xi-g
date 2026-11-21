const DEFAULT_SHEETS_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxyDkYofErceoBvrJe_R92oqrRK_g0CMlFcscjE07TrWMtZxtZjqdKmXSBfighxdMZtRw/exec";
const KAS_STORAGE_KEY = "xig_kas_transactions_v1";
const SHEETS_WEBHOOK_KEY = "xig_kas_sheets_webhook";

function getActiveSheetsWebhookUrl() {
    const saved = localStorage.getItem(SHEETS_WEBHOOK_KEY);
    return (saved && saved.trim()) ? saved.trim() : DEFAULT_SHEETS_WEBHOOK_URL;
}

function getKasTransactions() {
    try {
        const raw = localStorage.getItem(KAS_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function saveKasTransactions(list) {
    localStorage.setItem(KAS_STORAGE_KEY, JSON.stringify(list));
}

function formatRupiah(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID");
}

function renderKasPanel() {
    const tbody = document.getElementById("kas-tbody");
    const totalMasukEl = document.getElementById("kas-total-masuk");
    const totalKeluarEl = document.getElementById("kas-total-keluar");
    const saldoEl = document.getElementById("kas-saldo");
    const webhookInput = document.getElementById("sheets-webhook-url");
    const tanggalInput = document.getElementById("kas-tanggal");

    if (tanggalInput && !tanggalInput.value) {
        tanggalInput.value = new Date().toISOString().slice(0, 10);
    }
    if (webhookInput) {
        webhookInput.value = getActiveSheetsWebhookUrl();
    }
    if (!tbody) return;

    const list = getKasTransactions();
    let totalMasuk = 0;
    let totalKeluar = 0;

    list.forEach((item) => {
        const nominal = Number(item.nominal) || 0;
        if (item.jenis === "pemasukan") totalMasuk += nominal;
        else totalKeluar += nominal;
    });

    if (totalMasukEl) totalMasukEl.textContent = formatRupiah(totalMasuk);
    if (totalKeluarEl) totalKeluarEl.textContent = formatRupiah(totalKeluar);
    if (saldoEl) saldoEl.textContent = formatRupiah(totalMasuk - totalKeluar);

    if (list.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="p-6 text-center text-slate-400 text-xs">
                    Belum ada transaksi kas tersimpan. Silakan input transaksi di atas.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = list.map((item, idx) => {
        const isMasuk = item.jenis === "pemasukan";
        return `
            <tr class="hover:bg-navy-900/60 transition">
                <td class="p-3.5 text-center font-mono text-xs text-slate-400">${idx + 1}</td>
                <td class="p-3.5 font-mono text-xs text-slate-300">${item.tanggal}</td>
                <td class="p-3.5 font-semibold text-white">${item.keterangan}</td>
                <td class="p-3.5">
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${isMasuk ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'}">
                        ${isMasuk ? 'Pemasukan' : 'Pengeluaran'}
                    </span>
                </td>
                <td class="p-3.5 text-right font-extrabold ${isMasuk ? 'text-emerald-300' : 'text-rose-300'}">
                    ${isMasuk ? '+' : '-'} ${formatRupiah(item.nominal)}
                </td>
                <td class="p-3.5 text-center">
                    <button
                        type="button"
                        onclick="deleteKasItem('${item.id}')"
                        class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 transition cursor-pointer"
                    >
                        Hapus
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function saveSheetsWebhookUrl() {
    const input = document.getElementById("sheets-webhook-url");
    const statusEl = document.getElementById("kas-sync-status");
    if (!input) return;

    const url = input.value.trim();
    if (url) {
        localStorage.setItem(SHEETS_WEBHOOK_KEY, url);
    } else {
        localStorage.removeItem(SHEETS_WEBHOOK_KEY);
        input.value = DEFAULT_SHEETS_WEBHOOK_URL;
    }
    if (statusEl) {
        statusEl.textContent = "URL Google Apps Script tersimpan. Setiap simpan transaksi akan otomatis dikirim ke Google Sheets & tersimpan di web.";
    }
}

async function handleAddKasTransaction(event) {
    event.preventDefault();
    const tanggal = document.getElementById("kas-tanggal").value;
    const keterangan = document.getElementById("kas-keterangan").value.trim();
    const jenis = document.getElementById("kas-jenis").value;
    const nominal = Number(document.getElementById("kas-nominal").value);
    const statusEl = document.getElementById("kas-sync-status");

    if (!tanggal || !keterangan || !nominal || nominal <= 0) return;

    const entry = {
        id: String(Date.now()),
        tanggal,
        keterangan,
        jenis,
        nominal,
        dicatatOleh: getCurrentRole()
    };

    const list = getKasTransactions();
    list.push(entry);
    saveKasTransactions(list);
    renderKasPanel();

    document.getElementById("kas-keterangan").value = "";
    document.getElementById("kas-nominal").value = "";

    const webhookUrl = getActiveSheetsWebhookUrl();
    if (webhookUrl) {
        if (statusEl) statusEl.textContent = "Tersimpan di web. Mengirim ke Google Sheets...";
        try {
            await fetch(webhookUrl, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(entry)
            });
            if (statusEl) statusEl.textContent = "Tersimpan di web dan terkirim ke Google Sheets.";
        } catch (err) {
            if (statusEl) statusEl.textContent = "Tersimpan di web, tetapi gagal mengirim ke Google Sheets. Gunakan Download Excel (.xls).";
        }
    }
}

function deleteKasItem(id) {
    const list = getKasTransactions().filter((item) => item.id !== id);
    saveKasTransactions(list);
    renderKasPanel();
}

function clearKasData() {
    if (!confirm("Hapus semua data transaksi kas di web?")) return;
    localStorage.removeItem(KAS_STORAGE_KEY);
    renderKasPanel();
}

function exportKasToExcel() {
    const list = getKasTransactions();
    let totalMasuk = 0;
    let totalKeluar = 0;

    const rowsHtml = list.map((item, idx) => {
        const nominal = Number(item.nominal) || 0;
        if (item.jenis === "pemasukan") totalMasuk += nominal;
        else totalKeluar += nominal;

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>${item.tanggal}</td>
                <td>${item.keterangan}</td>
                <td>${item.jenis === "pemasukan" ? "Pemasukan" : "Pengeluaran"}</td>
                <td>${nominal}</td>
            </tr>
        `;
    }).join("");

    const saldo = totalMasuk - totalKeluar;
    const tableHtml = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="UTF-8"></head>
        <body>
            <h3>LAPORAN KAS KELAS XI G - MAN 1 LAMONGAN</h3>
            <table border="1">
                <thead>
                    <tr>
                        <th>No</th>
                        <th>Tanggal</th>
                        <th>Keterangan</th>
                        <th>Jenis</th>
                        <th>Nominal (Rp)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || '<tr><td colspan="5">Belum ada data transaksi</td></tr>'}
                </tbody>
                <tfoot>
                    <tr><td colspan="4"><strong>Total Pemasukan</strong></td><td><strong>${totalMasuk}</strong></td></tr>
                    <tr><td colspan="4"><strong>Total Pengeluaran</strong></td><td><strong>${totalKeluar}</strong></td></tr>
                    <tr><td colspan="4"><strong>Saldo Akhir</strong></td><td><strong>${saldo}</strong></td></tr>
                </tfoot>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob([tableHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Kas_Kelas_XI_G_${today}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

const classroomEquipment = [
    { name: "Kipas 01", category: "Pendingin Ruangan", desc: "Kipas angin kelas unit ke-1 dari 3 kipas." },
    { name: "Kipas 02", category: "Pendingin Ruangan", desc: "Kipas angin kelas unit ke-2 dari 3 kipas." },
    { name: "Kipas 03", category: "Pendingin Ruangan", desc: "Kipas angin kelas unit ke-3 dari 3 kipas." },
    { name: "Stopkontak 01", category: "Kelistrikan", desc: "1 unit stopkontak di ruang kelas XI G." },
    { name: "Galon 01", category: "Air Minum", desc: "Galon air minum unit ke-1 dari 2 galon." },
    { name: "Galon 02", category: "Air Minum", desc: "Galon air minum unit ke-2 dari 2 galon." },
    { name: "Lemari 01", category: "Penyimpanan", desc: "1 unit lemari penyimpanan kelas XI G." },
    { name: "Sapu 01", category: "Kebersihan", desc: "Sapu kebersihan unit ke-1 dari 2 sapu." },
    { name: "Sapu 02", category: "Kebersihan", desc: "Sapu kebersihan unit ke-2 dari 2 sapu." },
    { name: "Cikrak 01", category: "Kebersihan", desc: "Cikrak pengki sampah unit ke-1 dari 2 cikrak." },
    { name: "Cikrak 02", category: "Kebersihan", desc: "Cikrak pengki sampah unit ke-2 dari 2 cikrak." },
    { name: "Rak Sepatu 01", category: "Kerapian", desc: "1 unit rak sepatu untuk warga kelas XI G." },
    { name: "Jam Dinding 01", category: "Waktu KBM", desc: "1 unit jam dinding penanda waktu pelajaran." },
    { name: "Vas Bunga 01", category: "Dekorasi", desc: "1 unit vas bunga penghias ruang kelas XI G." }
];

function renderClassroomSeats() {
    const grid = document.getElementById("classroom-seats-grid");
    if (!grid) return;

    let html = "";
    for (let i = 1; i <= 36; i++) {
        const num = String(i).padStart(2, "0");
        const baris = Math.ceil(i / 6);
        const kolom = ((i - 1) % 6) + 1;
        const delayMs = (i - 1) * 20;

        html += `
            <button
                type="button"
                onclick="selectSeat(${i}, ${baris}, ${kolom})"
                style="animation-delay: ${delayMs}ms"
                class="seat-animate group bg-navy-900 hover:bg-navy-800 border border-slate-800 hover:border-electric-400 rounded-2xl p-2.5 text-center transition transform hover:-translate-y-0.5 cursor-pointer"
            >
                <div class="text-[10px] font-extrabold text-slate-400 group-hover:text-electric-300 mb-1.5">
                    SET #${num}
                </div>
                <div class="bg-electric-500/15 border border-electric-500/40 rounded-lg py-1 px-1.5 text-[10px] font-extrabold text-electric-300">
                    BANGKU ${num}
                </div>
                <div class="mt-1.5 bg-indigo-500/15 border border-indigo-500/40 rounded-lg py-1 px-1.5 text-[10px] font-extrabold text-indigo-300">
                    KURSI ${num}
                </div>
            </button>
        `;
    }
    grid.innerHTML = html;
}

function renderClassroomEquipment() {
    const eqGrid = document.getElementById("classroom-equipment-grid");
    if (!eqGrid) return;

    eqGrid.innerHTML = classroomEquipment.map((item, index) => {
        const delayMs = index * 35;
        return `
            <button
                type="button"
                onclick="selectEquipment('${item.name}', '${item.category}', '${item.desc}')"
                style="animation-delay: ${delayMs}ms"
                class="gear-animate bg-navy-950 hover:bg-navy-900 border border-slate-800 hover:border-emerald-400/70 rounded-2xl p-3.5 text-left transition cursor-pointer shadow-md"
            >
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    ${item.category}
                </div>
                <div class="text-xs sm:text-sm font-extrabold text-white mt-1">
                    ${item.name}
                </div>
                <div class="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    ${item.desc}
                </div>
            </button>
        `;
    }).join("");
}

function replayClassroomAnimation() {
    renderClassroomSeats();
    renderClassroomEquipment();
    const box = document.getElementById("seat-status-box");
    if (box) {
        box.innerHTML = `
            <span>Animasi tata letak <strong>36 bangku, 36 kursi & perlengkapan kelas</strong> diputar ulang.</span>
            <span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">Aktif</span>
        `;
    }
}

function selectSeat(num, baris, kolom) {
    const padded = String(num).padStart(2, "0");
    const box = document.getElementById("seat-status-box");
    if (!box) return;
    box.innerHTML = `
        <span>Dipilih: <strong>Bangku #${padded} & Kursi #${padded}</strong> • Baris ke-${baris}, Kolom ke-${kolom}</span>
        <span class="text-[11px] font-bold text-electric-400 bg-electric-500/10 px-2.5 py-1 rounded-lg">Posisi Siswa</span>
    `;
}

function selectClassroomZone(title, desc) {
    const box = document.getElementById("seat-status-box");
    if (!box) return;
    box.innerHTML = `
        <span><strong>${title}:</strong> ${desc}</span>
        <span class="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg">Area Depan</span>
    `;
}

function selectEquipment(name, category, desc) {
    const box = document.getElementById("seat-status-box");
    if (!box) return;
    box.innerHTML = `
        <span><strong>${name}</strong> (${category}): ${desc}</span>
        <span class="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg">Perlengkapan Kelas</span>
    `;
}

function toggleMobileMenu() {
    const panel = document.getElementById("mobile-menu-panel");
    const btn = document.getElementById("mobile-menu-btn");
    const icon = document.getElementById("mobile-menu-icon");
    if (!panel || !btn) return;

    const isOpen = !panel.classList.contains("hidden");
    if (isOpen) {
        panel.classList.add("hidden");
        btn.setAttribute("aria-expanded", "false");
        if (icon) icon.textContent = "☰";
    } else {
        panel.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
        if (icon) icon.textContent = "✕";
    }
}

const ACCESS_CREDENTIALS = {
    developer: { pin: "DEV2026", label: "Developer (Mahzuzan)", badgeColor: "bg-purple-600" },
    guru:      { pin: "GURU123", label: "Guru / Wali Kelas", badgeColor: "bg-amber-600" },
    bendahara: { pin: "KAS2026", label: "Bendahara Kelas", badgeColor: "bg-emerald-600" },
    siswa:     { pin: "XIG2026", label: "Siswa XI-Greatness", badgeColor: "bg-blue-600" },
    guest:     { pin: "",        label: "Pengunjung Biasa", badgeColor: "bg-slate-700" }
};

function getCurrentRole() {
    return localStorage.getItem("xig_active_role") || "guest";
}

function handleRoleLogin(event) {
    event.preventDefault();
    const selectedRole = document.getElementById("login-role").value;
    const inputPin = document.getElementById("login-pin").value.trim();
    const errorMsg = document.getElementById("login-error");

    if (selectedRole === "guest") {
        setRoleSession("guest");
        return;
    }

    const validPin = ACCESS_CREDENTIALS[selectedRole]?.pin;
    if (inputPin === validPin) {
        errorMsg.classList.add("hidden");
        setRoleSession(selectedRole);
    } else {
        errorMsg.textContent = "Kode akses salah! Silakan periksa kembali.";
        errorMsg.classList.remove("hidden");
    }
}

function setRoleSession(role) {
    localStorage.setItem("xig_active_role", role);
    closeLoginModal();
    updateAuthUI();
    location.reload();
}

function logoutRole() {
    localStorage.setItem("xig_active_role", "guest");
    updateAuthUI();
    location.reload();
}

function openLoginModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.classList.add("flex");
        togglePinInput();
    }
}

function closeLoginModal() {
    const modal = document.getElementById("auth-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }
}

function togglePinInput() {
    const roleSelect = document.getElementById("login-role");
    const pinWrapper = document.getElementById("pin-input-wrapper");
    const pinInput = document.getElementById("login-pin");
    if (!roleSelect || !pinWrapper) return;

    if (roleSelect.value === "guest") {
        pinWrapper.classList.add("hidden");
        pinInput.removeAttribute("required");
    } else {
        pinWrapper.classList.remove("hidden");
        pinInput.setAttribute("required", "true");
    }
}

function injectAuthModalIfMissing() {
    if (document.getElementById("auth-modal")) return;
    document.body.insertAdjacentHTML("beforeend", `
        <div id="auth-modal" class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 hidden items-center justify-center p-4">
            <div class="bg-navy-900 border border-slate-800 w-full max-w-md rounded-3xl p-7 shadow-2xl relative">
                <button type="button" onclick="closeLoginModal()" class="absolute top-5 right-5 text-slate-400 hover:text-white text-sm font-bold px-2.5 py-1 rounded-lg bg-navy-950 border border-slate-800 cursor-pointer">✕</button>
                <div class="mb-6">
                    <span class="text-[11px] font-extrabold uppercase tracking-wider text-electric-400 bg-electric-500/10 px-3 py-1 rounded-full border border-electric-500/20">Autentikasi Portal</span>
                    <h3 class="text-xl font-extrabold text-white mt-3">Pilih Hak Akses Masuk</h3>
                    <p class="text-xs text-slate-400 mt-1">Masuk sesuai peran Anda atau lanjutkan sebagai pengunjung biasa.</p>
                </div>
                <form onsubmit="handleRoleLogin(event)" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Peran / Jabatan</label>
                        <select id="login-role" onchange="togglePinInput()" class="w-full bg-navy-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-electric-500">
                            <option value="guest">Pengunjung Biasa (Tanpa Kode)</option>
                            <option value="siswa">Siswa XI-Greatness</option>
                            <option value="bendahara">Bendahara Kelas</option>
                            <option value="guru">Guru / Wali Kelas</option>
                            <option value="developer">Pembuat Web (Developer)</option>
                        </select>
                    </div>
                    <div id="pin-input-wrapper" class="hidden">
                        <label class="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">Kode Akses / PIN</label>
                        <input type="password" id="login-pin" placeholder="Masukkan kode akses..." class="w-full bg-navy-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-semibold text-white focus:outline-none focus:border-electric-500">
                    </div>
                    <p id="login-error" class="hidden text-xs font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-xl"></p>
                    <button type="submit" class="w-full py-3.5 bg-electric-600 hover:bg-electric-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-electric-600/30 transition cursor-pointer">MASUK KE PORTAL</button>
                </form>
            </div>
        </div>
    `);
}

function updateAuthUI() {
    injectAuthModalIfMissing();
    const role = getCurrentRole();
    const info = ACCESS_CREDENTIALS[role] || ACCESS_CREDENTIALS.guest;
    const authContainer = document.getElementById("nav-auth-container");

    if (authContainer) {
        if (role === "guest") {
            authContainer.innerHTML = `<button type="button" onclick="openLoginModal()" class="px-3 py-2 rounded-xl text-xs font-extrabold bg-electric-600 hover:bg-electric-500 text-white shadow-md transition cursor-pointer">MASUK / LOGIN</button>`;
        } else {
            authContainer.innerHTML = `
                <span class="px-2.5 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-extrabold text-white ${info.badgeColor} shadow-sm">${info.label.toUpperCase()}</span>
                <button type="button" onclick="logoutRole()" class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition cursor-pointer">KELUAR</button>
            `;
        }
    }

    document.querySelectorAll("[data-role]").forEach((el) => {
        const allowedRoles = el.getAttribute("data-role").split(",").map(r => r.trim());
        if (allowedRoles.includes(role)) {
            el.classList.remove("hidden");
        } else {
            el.classList.add("hidden");
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    renderClassroomSeats();
    renderClassroomEquipment();
    renderKasPanel();
    updateAuthUI();
});