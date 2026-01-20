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
            <div class="toast-body"><i class="bi ${isError ? 'bi-exclamation-triangle' : 'bi-check-circle'} me-2"></i>${msg}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>`;
    toastContainer.appendChild(toastEl);
    setTimeout(() => toastEl.remove(), 4000);
}

const passInput = document.getElementById("nuevaContrasena");
const confirmInput = document.getElementById("confirmarContrasena");

function validarPass() {
    if (USER_AUTH_GOOGLE) return;
    const p = passInput.value;
    const c = confirmInput.value;
    if (!c) { confirmInput.className = "form-control custom-input"; return; }
    if (p === c && p !== "") {
        confirmInput.classList.add("is-valid-pass"); confirmInput.classList.remove("is-invalid-pass");
    } else {
        confirmInput.classList.add("is-invalid-pass"); confirmInput.classList.remove("is-valid-pass");
    }
}

if(passInput) passInput.addEventListener("input", validarPass);
if(confirmInput) confirmInput.addEventListener("input", validarPass);

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
        inputs.forEach(i => {
            if (i.id !== "cedulaPerfil" && i.id !== "correoPerfil") i.disabled = false;
        });
        if (USER_AUTH_GOOGLE) {
            document.getElementById("nuevaContrasena").disabled = true;
            document.getElementById("confirmarContrasena").disabled = true;
        }
        btnActualizarPerfil.style.display = "inline-block";
        btnEditarPerfil.style.display = "none";
        showMessage("Edición habilitada");
    });
}

document.getElementById("formPerfil").addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const res = await fetch(`/actualizar_perfil/${USER_ID}`, { method: "PUT", body: formData });
    const data = await res.json();
    if (res.ok && data.ok) {
        showMessage("Perfil actualizado correctamente");
        inputs.forEach(i => i.disabled = true);
        btnActualizarPerfil.style.display = "none";
        btnEditarPerfil.style.display = "inline-block";
    } else showMessage(data.error || "Error al actualizar", true);
});

if (document.getElementById("btnCambiarContrasena")) {
    document.getElementById("btnCambiarContrasena").addEventListener("click", async () => {
        if (USER_AUTH_GOOGLE) return;
        const n = passInput.value.trim();
        if (!n || n !== confirmInput.value.trim()) { showMessage("Contraseñas no coinciden", true); return; }
        const res = await fetch("/cambiar_contrasena", { 
            method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nueva: n }) 
        });
        if (res.ok) { showMessage("Contraseña cambiada con éxito"); passInput.value = ""; confirmInput.value = ""; }
    });
}

if (USER_ROLE === 'admin') {
    const myModal = new bootstrap.Modal(document.getElementById('imgModal'));
    const searchInput = document.getElementById('userSearch');

    async function fetchUsuarios() {
        const res = await fetch("/listar_usuarios");
        if (res.ok) {
            let data = await res.json();
            allUsers = data.sort((a, b) => {
                const rA = (a.roles?.nombre_role || a.rol) === 'admin' ? 0 : 1;
                const rB = (b.roles?.nombre_role || b.rol) === 'admin' ? 0 : 1;
                return rA - rB;
            });
            filteredUsers = [...allUsers];
            renderUserTable();
        }
    }

    async function cambiarRol(id, nuevo) {
        if (String(id) === String(USER_ID)) return showMessage("Acción no permitida", true);
        const res = await fetch("/actualizar_rol_usuario", {
            method: "PUT", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: id, rol: nuevo })
        });
        if (res.ok) { showMessage("Rol actualizado"); fetchUsuarios(); }
    }

    function renderUserTable() {
        const list = document.getElementById("usuariosList");
        list.innerHTML = "";
        const start = (currentPage - 1) * recordsPerPage;
        const pageItems = filteredUsers.slice(start, start + recordsPerPage);
        
        pageItems.forEach(u => {
            const div = document.createElement("div");
            div.className = "list-group-item d-flex align-items-center justify-content-between py-3 fade-in";
            const rol = u.roles?.nombre_role || u.rol;
            const esYo = String(u.id_cliente) === String(USER_ID);
            const esGoogle = u.contrasena === "GOOGLE_AUTH_EXTERNAL";

            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle me-3 border shadow-sm" width="45" height="45" style="object-fit:cover;">
                    <div>
                        <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido} ${esYo ? '<span class="badge bg-secondary ms-1" style="font-size:0.6rem">TÚ</span>' : ''}</h6>
                        <small class="text-muted">${u.correo}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-4">
                    <div class="text-center" style="min-width:85px;">
                        <span class="badge ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} rounded-pill px-3 mb-1" style="font-size:0.65rem">${rol.toUpperCase()}</span>
                        <div class="auth-icon-container">
                            ${esGoogle ? `<img src="${GOOGLE_LOGO_PATH}" width="18" alt="Google">` : '<i class="bi bi-envelope-at text-muted"></i>'}
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-dark" ${esYo ? 'disabled' : ''} id="btnRol-${u.id_cliente}"><i class="bi bi-person-gear"></i></button>
                        <button class="btn btn-sm btn-light border" id="btnVer-${u.id_cliente}"><i class="bi bi-eye"></i></button>
                    </div>
                </div>`;
            
            list.appendChild(div);
            
            document.getElementById(`btnVer-${u.id_cliente}`).onclick = () => {
                document.getElementById("modalImg").src = u.imagen_url || '/static/default_icon_profile.png';
                document.getElementById("modalNombre").textContent = `${u.nombre} ${u.apellido}`;
                document.getElementById("modalId").textContent = u.id_cliente;
                document.getElementById("modalCedula").textContent = u.cedula || 'N/A';
                document.getElementById("modalTelefono").textContent = u.telefono || 'N/A';
                document.getElementById("modalCorreo").textContent = u.correo;
                document.getElementById("modalDireccion").textContent = u.direccion || 'N/A';
                document.getElementById("modalFecha").textContent = new Date(u.fecha_creacion).toLocaleDateString();
                document.getElementById("modalRol").textContent = rol.toUpperCase();
                
                document.getElementById("modalAuthIcon").innerHTML = esGoogle 
                    ? `<span class="badge bg-white text-dark border shadow-sm p-1 px-2"><img src="${GOOGLE_LOGO_PATH}" width="14" class="me-1"> Google</span>` 
                    : '<span class="badge bg-dark text-white p-1 px-2"><i class="bi bi-envelope-at me-1"></i> Local</span>';
                    
                myModal.show();
            };
            if(!esYo) document.getElementById(`btnRol-${u.id_cliente}`).onclick = () => cambiarRol(u.id_cliente, rol === 'admin' ? 'cliente' : 'admin');
        });
        renderPagination();
    }

    function renderPagination() {
        const total = Math.ceil(filteredUsers.length / recordsPerPage);
        const nav = document.getElementById("paginationControls");
        nav.innerHTML = "";
        for (let i = 1; i <= total; i++) {
            const li = document.createElement("li");
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            li.onclick = (e) => { e.preventDefault(); currentPage = i; renderUserTable(); };
            nav.appendChild(li);
        }
    }

    searchInput.addEventListener('input', (e) => {
        const t = e.target.value.toLowerCase();
        filteredUsers = allUsers.filter(u => u.nombre.toLowerCase().includes(t) || u.correo.toLowerCase().includes(t));
        currentPage = 1; renderUserTable();
    });

    fetchUsuarios();
}