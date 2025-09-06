const toastContainer = document.getElementById('toastContainer');
function showMessage(msg, isError=false){
    const toastEl = document.createElement('div');
    toastEl.className='toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role','alert');
    toastEl.setAttribute('aria-live','assertive');
    toastEl.setAttribute('aria-atomic','true');
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${isError?'❌':'✅'} ${msg}</div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl,{delay:800}).show();
}

const previewImagen = document.getElementById("previewImagen");
const inputFile = document.getElementById("imagen_url");
inputFile.addEventListener("change", e => {
    const file = e.target.files[0];
    if(file) previewImagen.src = URL.createObjectURL(file);
});

const formPerfil = document.getElementById("formPerfil");
const btnEditarPerfil = document.getElementById("btnEditarPerfil");
const btnActualizarPerfil = document.getElementById("btnActualizarPerfil");
const cedulaPerfil = document.getElementById("cedulaPerfil");
const nombrePerfil = document.getElementById("nombrePerfil");
const apellidoPerfil = document.getElementById("apellidoPerfil");
const telefonoPerfil = document.getElementById("telefonoPerfil");
const correoPerfil = document.getElementById("correoPerfil");
const direccionPerfil = document.getElementById("direccionPerfil");
const metodoPagoPerfil = document.getElementById("metodoPagoPerfil");
const rolSelect = document.getElementById("rolSelect");

btnEditarPerfil.addEventListener("click", () => {
    cedulaPerfil.disabled = false;
    nombrePerfil.disabled = false;
    apellidoPerfil.disabled = false;
    telefonoPerfil.disabled = false;
    correoPerfil.disabled = false;
    direccionPerfil.disabled = false;
    metodoPagoPerfil.disabled = false;
    inputFile.disabled = false;
    btnActualizarPerfil.style.display = "inline-block";
    btnEditarPerfil.style.display = "none";
});

formPerfil.addEventListener("submit", async e => {
    e.preventDefault();
    const formData = new FormData(formPerfil);
    const res = await fetch(`/actualizar_perfil/${window.userId}`, { method: "PUT", body: formData });
    const data = await res.json();
    if(res.ok && data.ok){
        showMessage("Perfil Actualizado");
        previewImagen.src = data.usuario.imagen_url || previewImagen.src;
        cedulaPerfil.value = data.usuario.cedula || '';
        nombrePerfil.value = data.usuario.nombre || '';
        apellidoPerfil.value = data.usuario.apellido || '';
        telefonoPerfil.value = data.usuario.telefono || '';
        correoPerfil.value = data.usuario.correo || '';
        direccionPerfil.value = data.usuario.direccion || '';
        metodoPagoPerfil.value = data.usuario.metodo_pago || '';
        rolSelect.value = data.usuario.roles.nombre_role || 'cliente';
        btnActualizarPerfil.style.display = "none";
        btnEditarPerfil.style.display = "inline-block";
        cedulaPerfil.disabled = true;
        nombrePerfil.disabled = true;
        apellidoPerfil.disabled = true;
        telefonoPerfil.disabled = true;
        correoPerfil.disabled = true;
        direccionPerfil.disabled = true;
        metodoPagoPerfil.disabled = true;
        rolSelect.disabled = true;
        inputFile.disabled = true;
    } else showMessage(data.error || "Error al actualizar perfil", true);
});

const btnCambiarContrasena = document.getElementById("btnCambiarContrasena");
btnCambiarContrasena.addEventListener("click", async () => {
    const nueva = document.getElementById("nuevaContrasena").value.trim();
    if(!nueva){ showMessage("Ingrese nueva contraseña", true); return; }
    const res = await fetch("/cambiar_contrasena", {
        method: "PUT",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ nueva })
    });
    const data = await res.json();
    if(res.ok && data.ok){ showMessage("Contraseña Actualizada"); document.getElementById("nuevaContrasena").value = ""; }
    else showMessage(data.error || "Error al cambiar contraseña", true);
});

if(window.isAdmin){
    const correoEliminar = document.getElementById("correoEliminar");
    const btnEliminarUsuario = document.getElementById("btnEliminarUsuario");
    const usuariosList = document.getElementById("usuariosList");

    btnEliminarUsuario.addEventListener("click", async () => {
        const correo = correoEliminar.value.trim();
        if(!correo){ showMessage("Debe ingresar un correo válido.", true); return; }
        if(!confirm(`¿Está seguro de eliminar el usuario con correo ${correo}?`)) return;
        const res = await fetch("/eliminar_usuario_por_correo", {
            method: "DELETE",
            headers: { "Content-Type":"application/json" },
            body: JSON.stringify({ correo })
        });
        const data = await res.json();
        if(res.ok && data.ok){ showMessage("Usuario Eliminado"); correoEliminar.value = ""; fetchUsuarios(); }
        else showMessage(data.error || "Error al eliminar usuario", true);
    });

    async function fetchUsuarios(){
        const res = await fetch("/listar_usuarios");
        if(res.ok){
            const data = await res.json();
            usuariosList.innerHTML = "";
            let adminsCount = data.filter(u => u.roles.nombre_role === "admin").length;
            data.forEach(u => {
                const div = document.createElement("div");
                div.className = "d-flex align-items-center justify-content-between mb-2";
                const leftDiv = document.createElement("div");
                leftDiv.className = "d-flex align-items-center";
                const img = document.createElement("img");
                img.src = u.imagen_url || "/static/default_icon_profile.png";
                img.className = "user-img-list";
                img.addEventListener("click", () => {
                    document.getElementById("modalImg").src = img.src;
                    new bootstrap.Modal(document.getElementById("imgModal")).show();
                });
                const nombre = document.createElement("span");
                nombre.textContent = u.nombre + " " + u.apellido + " (" + u.correo + ")";
                leftDiv.appendChild(img);
                leftDiv.appendChild(nombre);
                const rolUserSelect = document.createElement("select");
                rolUserSelect.className = "form-select w-auto";
                rolUserSelect.innerHTML = '<option value="cliente">Cliente</option><option value="admin">Admin</option>';
                rolUserSelect.value = u.roles.nombre_role;
                rolUserSelect.addEventListener("change", async () => {
                    if(rolUserSelect.value === "admin" && adminsCount >= 3){
                        showMessage("Máximo 3 administradores permitidos", true);
                        rolUserSelect.value = u.roles.nombre_role;
                        return;
                    }
                    try {
                        const resUpdate = await fetch("/actualizar_rol_usuario", {
                            method: "PUT",
                            headers: { "Content-Type":"application/json" },
                            body: JSON.stringify({ id: u.id_cliente, rol: rolUserSelect.value })
                        });
                        const result = await resUpdate.json();
                        if(resUpdate.ok && result.ok){
                            u.roles.nombre_role = rolUserSelect.value;
                            adminsCount = data.filter(user => user.roles.nombre_role === "admin").length;
                            showMessage("Rol Actualizado");
                        } else {
                            showMessage(result.error || "Error al actualizar rol", true);
                            rolUserSelect.value = u.roles.nombre_role;
                        }
                    } catch (error) {
                        showMessage("Error en la conexión con el servidor", true);
                        rolUserSelect.value = u.roles.nombre_role;
                    }
                });
                div.appendChild(leftDiv);
                div.appendChild(rolUserSelect);
                usuariosList.appendChild(div);
            });
        }
    }
    fetchUsuarios();
}