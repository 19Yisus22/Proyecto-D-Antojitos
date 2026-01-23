const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
let editandoComentario = null;
let comentariosActuales = []; 
const usuario = {id_usuario: window.userId};

const monitorConexion = {
    intervalo: null,
    frecuencia: 30000, 

    iniciar() {
        if (!usuario.id_usuario) return;
        this.enviarSenal();
        this.intervalo = setInterval(() => this.enviarSenal(), this.frecuencia);
    },

    async enviarSenal() {
        try {
            const url = "/actualizar_estado_comentarios";
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) {
            console.error("Error de presencia:", e);
        }
    }
};

function showMessage(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
            <span>${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem; opacity: 0.7;"></i>
    `;
    toastContainer.appendChild(toast);
    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function renderComentario(c) {
    const div = document.createElement("div");
    div.className = "message position-relative shadow-sm border rounded-4 p-3 mb-3 bg-white";
    div.id = `msg-${c.id}`;
    
    const info = c.usuario_info || {};
    const foto = info.foto_perfil || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const nombreUsuario = info.nombre_completo || (info.nombre ? `${info.nombre} ${info.apellido || ''}` : 'Usuario desconocido');
    const fecha = new Date(c.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    
    const esMiPropioComentario = String(c.id_usuario) === String(usuario.id_usuario);
    const estaConectado = info.conectado === true;
    const claseEstado = estaConectado ? 'estado-conectado' : 'estado-desconectado';

    div.innerHTML = `
        <div class="d-flex align-items-start">
            <div class="contenedor-foto-estado me-3">
                <img src="${foto}" class="rounded-circle border" width="50" height="50" style="object-fit:cover;">
                <span class="punto-estado ${claseEstado}"></span>
            </div>
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-primary" style="font-size:0.95rem;">${nombreUsuario}</span>
                    <div class="d-flex align-items-center">
                        <span class="text-muted small me-2">${fecha}</span>
                        ${esMiPropioComentario ? `
                            <div class="dropdown">
                                <i class="bi bi-three-dots-vertical btn-options text-muted" style="cursor:pointer; font-size: 1.2rem;"></i>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="mensaje-texto text-dark" style="font-size: 0.9rem; line-height: 1.4;">${c.mensaje}</div>
            </div>
        </div>
    `;

    if(esMiPropioComentario) {
        const btnOpt = div.querySelector(".btn-options");
        if(btnOpt) {
            btnOpt.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll(".comentario-dropdown").forEach(d => d.remove());
                const dd = document.createElement("ul");
                dd.className = "list-group position-absolute shadow-lg comentario-dropdown";
                dd.style.zIndex = "2000";
                dd.innerHTML = `
                    <li class="list-group-item list-group-item-action border-0 py-2 px-3" style="cursor:pointer; font-size: 0.9rem;">
                        <i class="bi bi-pencil me-2 text-primary"></i>Editar
                    </li>
                    <li class="list-group-item list-group-item-action border-0 py-2 px-3 text-danger" style="cursor:pointer; font-size: 0.9rem;">
                        <i class="bi bi-trash me-2"></i>Eliminar
                    </li>
                `;
                const rect = e.target.getBoundingClientRect();
                dd.style.position = "fixed";
                dd.style.top = `${rect.bottom + 5}px`;
                dd.style.left = `${rect.left - 100}px`;
                dd.querySelectorAll("li")[0].onclick = () => { iniciarEdicion(c.id, c.mensaje); dd.remove(); };
                dd.querySelectorAll("li")[1].onclick = () => { ejecutarEliminacionDirecta(c.id); dd.remove(); };
                document.body.appendChild(dd);
                document.addEventListener("click", () => dd.remove(), {once:true});
            };
        }
    }
    return div;
}

async function cargarComentarios() {
    try {
        const res = await fetch("/comentarios");
        if(!res.ok) return;
        const nuevosComentarios = await res.json();
        
        const stringNuevo = JSON.stringify(nuevosComentarios);
        const stringViejo = JSON.stringify(comentariosActuales);

        if (stringNuevo !== stringViejo) {
            comentariosActuales = nuevosComentarios;
            chatBox.innerHTML = "";
            comentariosActuales.forEach(c => chatBox.appendChild(renderComentario(c)));
            chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch(e) { 
        console.error("Error al sincronizar:", e); 
    }
}

async function ejecutarEliminacionDirecta(id) {
    const el = document.getElementById(`msg-${id}`);
    if(el) {
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
    }
    try {
        const res = await fetch(`/comentarios/${id}`, {method:"DELETE"});
        if(res.ok) {
            if(el) {
                el.style.transform = 'scale(0.9)';
                el.style.opacity = '0';
                setTimeout(() => {
                    el.remove();
                    showMessage("Comentario eliminado correctamente");
                    cargarComentarios();
                }, 300);
            }
        } else {
            if(el) el.style.opacity = '1';
            showMessage("No se pudo eliminar", true);
        }
    } catch(e) {
        if(el) el.style.opacity = '1';
        showMessage("Error de conexión", true);
    }
}

function iniciarEdicion(id, msg) {
    mensajeInput.value = msg;
    editandoComentario = id;
    sendBtn.innerHTML = `<i class="bi bi-check2-all me-2"></i>Guardar Cambios`;
    mensajeInput.focus();
}

sendBtn.onclick = async () => {
    const mensaje = mensajeInput.value.trim();
    if(!mensaje) return;
    const originalContent = sendBtn.innerHTML;
    sendBtn.disabled = true;
    sendBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${editandoComentario ? 'Guardando...' : 'Enviando...'}`;
    try {
        let res, url = "/comentarios", method = "POST";
        if(editandoComentario) {
            url = `/comentarios/${editandoComentario}`;
            method = "PUT";
        }
        res = await fetch(url, {
            method: method,
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({mensaje})
        });
        if(res.ok) {
            showMessage(editandoComentario ? "Cambios guardados" : "Mensaje enviado");
            mensajeInput.value = "";
            editandoComentario = null;
            sendBtn.innerHTML = `<i class="bi bi-send me-2"></i>Enviar Sugerencia`;
            cargarComentarios();
        } else {
            showMessage("Error al procesar", true);
            sendBtn.innerHTML = originalContent;
        }
    } catch(e) { 
        showMessage("Error de red", true); 
        sendBtn.innerHTML = originalContent;
    } finally {
        sendBtn.disabled = false;
    }
};

window.onload = () => {
    cargarComentarios();
    monitorConexion.iniciar();
    setInterval(cargarComentarios, 5000);
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-comentarios.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}