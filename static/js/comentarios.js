const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
const accionesContainer = document.getElementById('accionesDropdownContainer');
const accionesDropdown = document.getElementById('accionesDropdown');
let comentarioAbierto = null;
let editandoComentario = null;

const usuario = {id_usuario: window.userId};

function showMessage(msg, isError=false){
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role','alert');
    toastEl.setAttribute('aria-live','assertive');
    toastEl.setAttribute('aria-atomic','true');
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${isError?'❌':'✅'} ${msg}</div>
        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl,{delay:800}).show();
}

function bloquearAcciones(){
    document.querySelectorAll("button, input, textarea").forEach(el => el.disabled = true);
}

function renderComentario(c){
    const div = document.createElement("div");
    div.classList.add("message");
    div.dataset.id = c.id;
    div.dataset.usuario = c.id_usuario;
    const fotoPerfil = c.usuario_info?.foto_perfil;
    const nombreUsuario = c.usuario_info?.nombre_usuario || 'Usuario';
    let imgHtml = '';
    if(fotoPerfil){
        imgHtml = `<img src="${fotoPerfil}" alt="perfil" class="rounded-circle me-2" style="width:40px;height:40px;object-fit:cover;">`;
    }
    div.innerHTML = `
        <div class="d-flex align-items-start">
            ${imgHtml}
            <div class="message-content flex-grow-1">
                <div class="message-header d-flex justify-content-between">
                    <span class="username fw-bold">${nombreUsuario}</span>
                    <span class="time text-muted small" style="margin-left:4px;">
                        ${new Date(c.created_at).toLocaleString('es-CO',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </span>
                </div>
                <div class="mensaje-texto">${c.mensaje}</div>
            </div>
        </div>
    `;
    if(c.id_usuario === usuario.id_usuario){
        const dots = document.createElement("i");
        dots.className = "bi bi-three-dots-vertical fw-bold";
        dots.style.cursor = "pointer";
        dots.style.position = "absolute";
        dots.style.top = "10px";
        dots.style.right = "10px";
        dots.style.fontSize = "1.5rem";
        dots.addEventListener("click", (e)=>{
            e.stopPropagation();
            if(comentarioAbierto === c.id){
                accionesContainer.style.display = "none";
                comentarioAbierto = null;
                return;
            }
            accionesDropdown.innerHTML = `<li><a class="dropdown-item" href="#" onclick="iniciarEdicion('${c.id}','${c.mensaje.replace(/'/g,"\\'")}')">✏️ Editar</a></li>
                <li><a class="dropdown-item" href="#" onclick="eliminarComentario('${c.id}')">🗑️ Eliminar</a></li>`;
            const rect = e.target.getBoundingClientRect();
            accionesContainer.style.top = `${rect.bottom + window.scrollY}px`;
            accionesContainer.style.left = `${rect.left + window.scrollX}px`;
            accionesContainer.style.display = "block";
            comentarioAbierto = c.id;
        });
        div.appendChild(dots);
    }
    return div;
}

async function cargarComentarios(){
    try{
        const res = await fetch("/comentarios");
        if(res.status===401 || res.status===403){
            showMessage("Inicie Sesión para ver comentarios", true);
            bloquearAcciones();
            return;
        }
        const data = await res.json();
        chatBox.innerHTML = "";
        data.forEach(c => chatBox.appendChild(renderComentario(c)));
        chatBox.scrollTop = chatBox.scrollHeight;
    }catch(error){
        showMessage("Error al cargar comentarios",true);
    }
}

function iniciarEdicion(id,mensaje){
    mensajeInput.value = mensaje;
    editandoComentario = id;
    accionesContainer.style.display = "none";
    comentarioAbierto = null;
    sendBtn.textContent = "Guardar Cambios";
    mensajeInput.focus();
}

sendBtn.addEventListener("click", async()=>{
    const mensaje = mensajeInput.value.trim();
    if(!mensaje) return;
    try{
        if(editandoComentario){
            const res = await fetch(`/comentarios/${editandoComentario}`,{
                method:"PUT",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({mensaje})
            });
            if(res.ok) showMessage("Comentario Editado");
            editandoComentario = null;
            sendBtn.textContent = "Enviar Sugerencia";
        } else {
            const res = await fetch("/comentarios",{
                method:"POST",
                headers:{"Content-Type":"application/json"},
                body:JSON.stringify({mensaje})
            });
            if(res.ok) showMessage("Comentario Publicado");
        }
        mensajeInput.value = "";
        cargarComentarios();
    }catch(error){
        showMessage("Error enviando comentario",true);
    }
});

async function eliminarComentario(id){
    try{
        const res = await fetch(`/comentarios/${id}`,{method:"DELETE"});
        if(res.ok){
            showMessage("Comentario eliminado");
            cargarComentarios();
        }
    }catch(error){
        showMessage("Error eliminando comentario",true);
    }
}

document.addEventListener("click",(e)=>{
    if(!accionesContainer.contains(e.target) && !e.target.closest(".bi-three-dots-vertical")){
        accionesContainer.style.display = "none";
        comentarioAbierto = null;
    }
});

cargarComentarios();
