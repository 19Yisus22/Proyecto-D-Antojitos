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

function setLoading(btn, isLoading, originalText) {
    if (isLoading) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Procesando...`;
    } else {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

const passInput = document.getElementById("nuevaContrasena");
const confirmInput = document.getElementById("confirmarContrasena");

function validarPass() {
    if (USER_AUTH_GOOGLE) return;
    const p = passInput.value;
    const c = confirmInput.value;
    if (!c) {
        confirmInput.style.borderColor = "#ddd";
        return;
    }
    if (p === c && p !== "") {
        confirmInput.style.borderColor = "#28a745";
        confirmInput.style.boxShadow = "0 0 0 0.25rem rgba(40, 167, 69, 0.25)";
    } else {
        confirmInput.style.borderColor = "#dc3545";
        confirmInput.style.boxShadow = "0 0 0 0.25rem rgba(220, 53, 69, 0.25)";
    }
}

if (passInput) passInput.addEventListener("input", validarPass);
if (confirmInput) confirmInput.addEventListener("input", validarPass);

const btnCambiarContrasena = document.getElementById("btnCambiarContrasena");
if (btnCambiarContrasena) {
    btnCambiarContrasena.addEventListener("click", async () => {
        const p = passInput.value;
        const c = confirmInput.value;
        if (!p || p !== c) {
            showMessage("Las contraseñas no coinciden o están vacías", true);
            return;
        }
        const originalText = btnCambiarContrasena.innerHTML;
        setLoading(btnCambiarContrasena, true, originalText);
        try {
            const res = await fetch("/cambiar_contrasena_perfil", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nueva_contrasena: p })
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                showMessage("Contraseña actualizada correctamente");
                passInput.value = "";
                confirmInput.value = "";
                confirmInput.style.borderColor = "#ddd";
            } else {
                showMessage(data.error || "Error al cambiar contraseña", true);
            }
        } catch (e) {
            showMessage("Error de conexión", true);
        } finally {
            setLoading(btnCambiarContrasena, false, originalText);
        }
    });
}

const btnEditarPerfil = document.getElementById("btnEditarPerfil");
const btnActualizarPerfil = document.getElementById("btnActualizarPerfil");
const inputs = document.querySelectorAll('#formPerfil input, #formPerfil textarea, #formPerfil select');

if (btnEditarPerfil) {
    btnEditarPerfil.addEventListener("click", () => {
        inputs.forEach(i => {
            if (i.id !== "correoPerfil" && !i.readOnly) i.disabled = false;
        });
        document.getElementById("imagen_url").disabled = false;
        btnActualizarPerfil.style.display = "inline-block";
        btnEditarPerfil.style.display = "none";
        showMessage("Edición habilitada");
    });
}

document.getElementById("formPerfil").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("btnActualizarPerfil");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);

    inputs.forEach(i => i.disabled = false);

    const formData = new FormData(e.target);
    try {
        const res = await fetch(`/actualizar_perfil/${USER_ID}`, { 
            method: "PUT", 
            body: formData 
        });
        const data = await res.json();

        if (res.ok && data.ok) {
            showMessage("Perfil actualizado");
            setTimeout(() => location.reload(), 1000);
        } else {
            let errorMsg = data.error || "Error al guardar cambios";
            if (errorMsg.toLowerCase().includes("cedula") || errorMsg.toLowerCase().includes("cédula")) {
                errorMsg = "La cédula ingresada ya está registrada por otro usuario";
            } else if (errorMsg.toLowerCase().includes("correo") || errorMsg.toLowerCase().includes("email")) {
                errorMsg = "El correo ingresado ya está en uso";
            }
            
            showMessage(errorMsg, true);
            
            inputs.forEach(i => {
                if (i.id === "correoPerfil" || i.readOnly) i.disabled = true;
            });
        }
    } catch (error) {
        showMessage("Error de comunicación con el servidor", true);
    } finally {
        setLoading(btn, false, originalText);
    }
});

async function eliminarUsuarioPorCorreo() {
    const emailInput = document.getElementById('correoEliminar');
    const correo = emailInput.value.trim().toLowerCase();
    if (!correo) {
        showMessage("Ingrese el correo", true);
        return;
    }
    const btn = document.getElementById("btnEliminarUsuario");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);
    try {
        const res = await fetch("/eliminar_usuario_admin", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo: correo })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            showMessage("Usuario eliminado");
            emailInput.value = "";
            fetchUsuarios();
        } else {
            showMessage(data.error || "Error al eliminar", true);
        }
    } catch (error) {
        showMessage("Error de conexión", true);
    } finally {
        setLoading(btn, false, originalText);
    }
}

const btnEliminar = document.getElementById("btnEliminarUsuario");
if (btnEliminar) btnEliminar.addEventListener("click", eliminarUsuarioPorCorreo);

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

function renderUserTable() {
    const list = document.getElementById("usuariosList");
    if (!list) return;
    list.innerHTML = "";
    const start = (currentPage - 1) * recordsPerPage;
    const pageItems = filteredUsers.slice(start, start + recordsPerPage);
    pageItems.forEach(u => {
        const div = document.createElement("div");
        div.className = "list-group-item d-flex align-items-center justify-content-between py-3 fade-in";
        const rol = u.roles?.nombre_role || u.rol || 'cliente';
        const esYo = String(u.id_cliente) === String(USER_ID);
        div.innerHTML = `
            <div class="d-flex align-items-center">
                <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle me-3 border shadow-sm" width="45" height="45" style="object-fit:cover;">
                <div>
                    <h6 class="mb-0 fw-bold">${u.nombre} ${u.apellido} ${esYo ? '<span class="badge bg-success ms-1" style="font-size: 0.6rem;">TÚ</span>' : ''}</h6>
                    <small class="text-muted">${u.correo}</small>
                </div>
            </div>
            <div class="d-flex align-items-center gap-4">
                <span class="badge ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} rounded-pill px-3">${rol.toUpperCase()}</span>
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-outline-dark" ${esYo ? 'disabled' : ''} id="btnRol-${u.id_cliente}"><i class="bi bi-person-up"></i></button>
                    <button class="btn btn-sm btn-light border" id="btnVer-${u.id_cliente}"><i class="bi bi-eye"></i></button>
                </div>
            </div>`;
        list.appendChild(div);
        document.getElementById(`btnVer-${u.id_cliente}`).onclick = () => mostrarModalDetalles(u);
        const btnR = document.getElementById(`btnRol-${u.id_cliente}`);
        if (!esYo && btnR) {
            btnR.onclick = async () => {
                const originalText = btnR.innerHTML;
                setLoading(btnR, true, originalText);
                await cambiarRol(u.id_cliente, rol === 'admin' ? 'cliente' : 'admin');
                setLoading(btnR, false, originalText);
            };
        }
    });
    document.getElementById("countVisible").textContent = pageItems.length;
    document.getElementById("countUsers").textContent = filteredUsers.length;
    renderPagination();
}

function mostrarModalDetalles(u) {
    let modalEl = document.getElementById('imgModal');
    if (!modalEl) {
        const html = `<div class="modal fade" id="imgModal" tabindex="-1"><div class="modal-dialog modal-dialog-centered"><div class="modal-content border-0 shadow"><div class="modal-header bg-dark text-white"><h5 class="modal-title">Expediente de Usuario</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body p-4" id="modalDetallesBody"></div></div></div></div>`;
        document.body.insertAdjacentHTML('beforeend', html);
        modalEl = document.getElementById('imgModal');
    }
    const rol = u.roles?.nombre_role || u.rol || 'cliente';
    const fecha = u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleString() : 'No disponible';
    document.getElementById("modalDetallesBody").innerHTML = `
        <div class="text-center mb-4">
            <img src="${u.imagen_url || '/static/default_icon_profile.png'}" class="rounded-circle border shadow-sm mb-3" width="100" height="100" style="object-fit:cover;">
            <h4 class="fw-bold mb-0">${u.nombre} ${u.apellido}</h4>
            <small class="text-muted d-block mb-2">ID: ${u.id_cliente}</small>
            <span class="badge ${rol === 'admin' ? 'bg-danger' : 'bg-primary'} px-3">${rol.toUpperCase()}</span>
        </div>
        <div class="row g-3 px-2">
            <div class="col-12 border-bottom pb-1"><small class="text-muted d-block small">CORREO</small><span class="fw-bold">${u.correo}</span></div>
            <div class="col-6 border-bottom pb-1"><small class="text-muted d-block small">CÉDULA</small><span class="fw-bold">${u.cedula || 'N/A'}</span></div>
            <div class="col-6 border-bottom pb-1"><small class="text-muted d-block small">TELÉFONO</small><span class="fw-bold">${u.telefono || 'N/A'}</span></div>
            <div class="col-12 border-bottom pb-1"><small class="text-muted d-block small">DIRECCIÓN</small><span class="fw-bold">${u.direccion || 'N/A'}</span></div>
            <div class="col-6 border-bottom pb-1"><small class="text-muted d-block small">MÉTODO PAGO</small><span class="fw-bold">${u.metodo_pago || 'Efectivo'}</span></div>
            <div class="col-6 border-bottom pb-1"><small class="text-muted d-block small">REGISTRO</small><span class="fw-bold" style="font-size:0.8rem">${fecha}</span></div>
        </div>`;
    new bootstrap.Modal(modalEl).show();
}

async function cambiarRol(id, nuevo) {
    if (nuevo === 'admin' && allUsers.filter(u => (u.roles?.nombre_role || u.rol) === 'admin').length >= 3) {
        showMessage("Máximo 3 administradores", true);
        return;
    }
    const res = await fetch("/actualizar_rol_usuario", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, rol: nuevo })
    });
    if (res.ok) { showMessage("Rol actualizado"); fetchUsuarios(); }
}

function exportarUsuariosExcel() {
    if (filteredUsers.length === 0) {
        showMessage("No hay datos para exportar", true);
        return;
    }
    const btn = document.getElementById("btnExportarExcel");
    const originalText = btn.innerHTML;
    setLoading(btn, true, originalText);
    try {
        const dataParaExcel = filteredUsers.map(u => ({
            "ID Cliente": u.id_cliente,
            "Nombre": u.nombre,
            "Apellido": u.apellido,
            "Cédula": u.cedula || 'N/A',
            "Correo": u.correo,
            "Teléfono": u.telefono || 'N/A',
            "Dirección": u.direccion || 'N/A',
            "Rol": (u.roles?.nombre_role || u.rol || 'cliente').toUpperCase(),
            "Método Pago": u.metodo_pago || 'Efectivo',
            "Fecha Registro": u.fecha_creacion ? new Date(u.fecha_creacion).toLocaleString() : 'N/A'
        }));
        const ws = XLSX.utils.json_to_sheet(dataParaExcel);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Usuarios");
        XLSX.writeFile(wb, "Reporte_Usuarios_Antojitos.xlsx");
        showMessage("Excel generado correctamente");
    } catch (e) {
        showMessage("Error al exportar Excel", true);
    } finally {
        setLoading(btn, false, originalText);
    }
}

const btnExportar = document.getElementById("btnExportarExcel");
if (btnExportar) btnExportar.addEventListener("click", exportarUsuariosExcel);

function renderPagination() {
    const total = Math.ceil(filteredUsers.length / recordsPerPage);
    const nav = document.getElementById("paginationControls");
    if (!nav) return;
    nav.innerHTML = "";
    for (let i = 1; i <= total; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link shadow-sm" href="#">${i}</a>`;
        li.onclick = (e) => { e.preventDefault(); currentPage = i; renderUserTable(); };
        nav.appendChild(li);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (USER_ROLE === 'admin') {
        const searchInput = document.getElementById('userSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const t = e.target.value.toLowerCase();
                filteredUsers = allUsers.filter(u => (u.nombre + " " + u.apellido).toLowerCase().includes(t) || u.correo.toLowerCase().includes(t));
                currentPage = 1; renderUserTable();
            });
        }
        fetchUsuarios();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-perfil.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}