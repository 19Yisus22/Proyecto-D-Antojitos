const toastContainer = document.getElementById('toastContainer');
let allUsers = [];
let filteredUsers = [];
let currentPage = 1;
const recordsPerPage = 7;

function showMessage(msg, isError = false) {
    const toastEl = document.createElement('div');
    toastEl.className = `toast show align-items-center text-white ${isError ? 'bg-danger' : 'bg-dark'} border-0 mb-2 fade-in`;
    toastEl.style.minWidth = "250px";
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                <i class="bi ${isError ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-2"></i>${msg}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>`;
    toastContainer.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 3500);
}

const passInput = document.getElementById("nuevaContrasena");
const confirmInput = document.getElementById("confirmarContrasena");

function validarPass() {
    const p = passInput.value;
    const c = confirmInput.value;
    if (!c) { confirmInput.className = "form-control custom-input"; return; }
    if (p === c && p !== "") {
        confirmInput.classList.add("is-valid-pass"); confirmInput.classList.remove("is-invalid-pass");
    } else {
        confirmInput.classList.add("is-invalid-pass"); confirmInput.classList.remove("is-valid-pass");
    }
}

passInput.addEventListener("input", validarPass);
confirmInput.addEventListener("input", validarPass);

const inputFile = document.getElementById("imagen_url");
if (inputFile) {
    inputFile.addEventListener("change", e => {
        const file = e.target.files[0];
        if (file) document.getElementById("previewImagen").src = URL.createObjectURL(file);
    });
}

const btnEditarPerfil = document.getElementById("btnEditarPerfil");
const btnActualizarPerfil = document.getElementById("btnActualizarPerfil");
const inputs = document.querySelectorAll('#formPerfil input, #formPerfil textarea, #formPerfil select');

if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener("click", () => {
        inputs.forEach(i => i.disabled = false);
        btnActualizarPerfil.style.display = "inline-block";
        btnEditarPerfil.style.display = "none";
        showMessage("Modo de edición activado");
    });
}

document.getElementById("formPerfil").addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`/actualizar_perfil/${USER_ID}`, { method: "PUT", body: formData });
    const data = await res.json();
    if (res.ok && data.ok) {
        showMessage("¡Perfil actualizado con éxito!");
        inputs.forEach(i => i.disabled = true);
        btnActualizarPerfil.style.display = "none";
        btnEditarPerfil.style.display = "inline-block";
    } else showMessage(data.error || "Error al actualizar", true);
});

document.getElementById("btnCambiarContrasena").addEventListener("click", async () => {
    const n = passInput.value.trim();
    if (!n || n !== confirmInput.value.trim()) { showMessage("Las contraseñas no coinciden", true); return; }
    const res = await fetch("/cambiar_contrasena", { 
        method: "PUT", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ nueva: n }) 
    });
    if (res.ok) {
        showMessage("Contraseña actualizada exitosamente");
        passInput.value = ""; confirmInput.value = "";
        confirmInput.className = "form-control custom-input";
    }
});

if (USER_ROLE === 'admin') {
    const modalElement = document.getElementById('imgModal');
    const myModal = new bootstrap.Modal(modalElement);
    const searchInput = document.getElementById('userSearch');

    async function fetchUsuarios() {
        const res = await fetch("/listar_usuarios");
        if (res.ok) {
            allUsers = await res.json();
            filteredUsers = [...allUsers];
            renderUserTable();
        }
    }

    function renderUserTable() {
        const list = document.getElementById("usuariosList");
        list.innerHTML = "";
        
        const start = (currentPage - 1) * recordsPerPage;
        const end = start + recordsPerPage;
        const pageItems = filteredUsers.slice(start, end);

        document.getElementById("countUsers").textContent = allUsers.length;
        document.getElementById("countVisible").textContent = filteredUsers.length;

        pageItems.forEach(u => {
            const div = document.createElement("div");
            div.className = "list-group-item d-flex align-items-center justify-content-between py-3 user-item fade-in";
            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${u.imagen_url || '/static/uploads/default_icon_profile.png'}" 
                         class="rounded-circle me-3 shadow-sm border" width="45" height="45" style="object-fit:cover;cursor:pointer;">
                    <div>
                        <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido}</h6>
                        <small class="text-muted">${u.correo}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <span class="badge ${u.roles.nombre_role === 'admin' ? 'bg-danger' : 'bg-primary'} rounded-pill px-3">${u.roles.nombre_role}</span>
                    <button class="btn btn-sm btn-light border btn-view-user" data-id="${u.id_cliente}"><i class="bi bi-eye"></i></button>
                </div>`;
            
            div.querySelector('.btn-view-user').onclick = () => showUserModal(u);
            list.appendChild(div);
        });
        renderPagination();
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredUsers.length / recordsPerPage);
        const nav = document.getElementById("paginationControls");
        nav.innerHTML = "";

        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement("li");
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.onclick = (e) => { e.preventDefault(); currentPage = i; renderUserTable(); };
            nav.appendChild(li);
        }
    }

    function showUserModal(u) {
        document.getElementById("modalImg").src = u.imagen_url || '/static/uploads/default_icon_profile.png';
        document.getElementById("modalNombre").textContent = `${u.nombre} ${u.apellido}`;
        document.getElementById("modalId").textContent = u.id_cliente;
        document.getElementById("modalCedula").textContent = u.cedula || 'N/A';
        document.getElementById("modalTelefono").textContent = u.telefono || 'N/A';
        document.getElementById("modalCorreo").textContent = u.correo;
        document.getElementById("modalDireccion").textContent = u.direccion || 'N/A';
        document.getElementById("modalFecha").textContent = new Date(u.fecha_creacion).toLocaleDateString();
        document.getElementById("modalRol").textContent = u.roles.nombre_role.toUpperCase();
        
        modalElement.removeAttribute('aria-hidden');
        myModal.show();
    }

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(safeTerm, 'i');

        filteredUsers = allUsers.filter(u => 
            regex.test(u.nombre) || 
            regex.test(u.apellido) || 
            regex.test(u.correo)
        );
        currentPage = 1;
        renderUserTable();
    });

    document.getElementById("btnEliminarUsuario").onclick = async () => {
        const correo = document.getElementById("correoEliminar").value.trim();
        if (!correo) return showMessage("Ingrese un correo válido", true);
        
        if (confirm(`¿Eliminar permanentemente a ${correo}?`)) {
            const res = await fetch(`/eliminar_usuario/${correo}`, { method: "DELETE" });
            if (res.ok) {
                showMessage("Usuario eliminado");
                document.getElementById("correoEliminar").value = "";
                fetchUsuarios();
            } else showMessage("No se pudo eliminar el usuario", true);
        }
    };

    fetchUsuarios();
}