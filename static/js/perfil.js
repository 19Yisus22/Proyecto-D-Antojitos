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
    setTimeout(() => toastEl.remove(), 4000);
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
        inputs.forEach(i => i.disabled = false);
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

document.getElementById("btnCambiarContrasena").addEventListener("click", async () => {
    const n = passInput.value.trim();
    if (!n || n !== confirmInput.value.trim()) { showMessage("Contraseñas no coinciden", true); return; }
    const res = await fetch("/cambiar_contrasena", { 
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nueva: n }) 
    });
    if (res.ok) {
        showMessage("Contraseña cambiada con éxito");
        passInput.value = ""; confirmInput.value = "";
    }
});

if (USER_ROLE === 'admin') {
    const myModal = new bootstrap.Modal(document.getElementById('imgModal'));
    const searchInput = document.getElementById('userSearch');

    async function fetchUsuarios() {
        const res = await fetch("/listar_usuarios");
        if (res.ok) {
            let data = await res.json();
            allUsers = data.sort((a, b) => {
                const rolA = (a.roles?.nombre_role || a.rol) === 'admin' ? 0 : 1;
                const rolB = (b.roles?.nombre_role || b.rol) === 'admin' ? 0 : 1;
                return rolA - rolB;
            });
            filteredUsers = [...allUsers];
            renderUserTable();
        }
    }

    async function cambiarRol(id, nuevo) {
        if (String(id) === String(USER_ID)) return showMessage("No puedes cambiar tu propio rol", true);
        
        if (nuevo === 'admin') {
            const admins = allUsers.filter(u => (u.roles?.nombre_role || u.rol) === 'admin');
            if (admins.length >= 3) {
                return showMessage("Límite de 3 administradores alcanzado. No se pueden asignar más.", true);
            }
        }

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
        document.getElementById("countUsers").textContent = allUsers.length;
        document.getElementById("countVisible").textContent = filteredUsers.length;

        pageItems.forEach(u => {
            const div = document.createElement("div");
            div.className = "list-group-item d-flex align-items-center justify-content-between py-3 fade-in";
            const rol = u.roles?.nombre_role || u.rol;
            const nuevo = rol === 'admin' ? 'cliente' : 'admin';
            const esYo = String(u.id_cliente) === String(USER_ID);

            div.innerHTML = `
                <div class="d-flex align-items-center">
                    <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle me-3 border shadow-sm" width="45" height="45" style="object-fit:cover;">
                    <div>
                        <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido} ${esYo ? '<span class="badge bg-secondary ms-1">Tú</span>' : ''}</h6>
                        <small class="text-muted">${u.correo}</small>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} rounded-pill px-3">${rol}</span>
                    <button class="btn btn-sm btn-outline-dark" ${esYo ? 'disabled' : ''} id="btnRol-${u.id_cliente}"><i class="bi bi-person-gear"></i></button>
                    <button class="btn btn-sm btn-light border" id="btnVer-${u.id_cliente}"><i class="bi bi-eye"></i></button>
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
                myModal.show();
            };
            
            if(!esYo) {
                document.getElementById(`btnRol-${u.id_cliente}`).onclick = () => cambiarRol(u.id_cliente, nuevo);
            }
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

    document.getElementById("btnExportarExcel").onclick = () => {
        if (allUsers.length === 0) return showMessage("No hay datos", true);
        const wsData = allUsers.map(u => ({
            "FECHA REGISTRO": new Date(u.fecha_creacion).toLocaleDateString(),
            "ROL": (u.roles?.nombre_role || u.rol).toUpperCase(),
            "NOMBRE": u.nombre,
            "APELLIDO": u.apellido,
            "CÉDULA": u.cedula || 'N/A',
            "CORREO": u.correo,
            "TELÉFONO": u.telefono || 'N/A',
            "DIRECCIÓN": u.direccion || 'N/A',
            "MÉTODO PAGO": u.metodo_pago || 'N/A'
        }));
        const ws = XLSX.utils.json_to_sheet(wsData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
        XLSX.writeFile(wb, `Reporte_D_Antojitos_${new Date().getTime()}.xlsx`);
    };

    document.getElementById("btnEliminarUsuario").onclick = async () => {
        const c = document.getElementById("correoEliminar").value.trim().toLowerCase();
        if (!c) return showMessage("Ingresa un correo", true);
        const res = await fetch("/eliminar_usuario_por_correo", { 
            method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo: c })
        });
        if (res.ok) { showMessage("Usuario eliminado"); fetchUsuarios(); document.getElementById("correoEliminar").value = ""; }
        else showMessage("No se pudo eliminar", true);
    };
    fetchUsuarios();
}