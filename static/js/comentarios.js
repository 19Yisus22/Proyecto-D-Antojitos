const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
let editandoComentario = null;
const usuario = {id_usuario: window.userId};

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
    div.className = "message";
    div.id = `msg-${c.id}`;
    const foto = c.usuario_info?.foto_perfil || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const nombre = c.usuario_info?.nombre_usuario || 'Usuario';
    const fecha = new Date(c.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});

    div.innerHTML = `
        <div class="d-flex align-items-start position-relative">
            <img src="${foto}" class="rounded-circle me-3 foto-click" width="45" height="45" style="object-fit:cover; cursor:pointer;">
            <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-primary" style="font-size:0.9rem;">${nombre}</span>
                    <span class="text-muted" style="font-size:0.75rem;">${fecha}</span>
                </div>
                <div class="mensaje-texto">${c.mensaje}</div>
            </div>
            ${c.id_usuario === usuario.id_usuario ? `<i class="bi bi-three-dots-vertical ms-2 btn-options" style="cursor:pointer;"></i>` : ''}
        </div>
    `;

    if(c.id_usuario === usuario.id_usuario) {
        div.querySelector(".btn-options").onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".comentario-dropdown").forEach(d => d.remove());
            const dd = document.createElement("ul");
            dd.className = "list-group position-absolute shadow comentario-dropdown";
            dd.innerHTML = `
                <li class="list-group-item py-2" style="cursor:pointer;"><i class="bi bi-pencil me-2"></i>Editar</li>
                <li class="list-group-item py-2 text-danger" style="cursor:pointer;"><i class="bi bi-trash me-2"></i>Eliminar</li>
            `;
            const r = e.target.getBoundingClientRect();
            dd.style.top = `${r.bottom + window.scrollY}px`;
            dd.style.left = `${r.left + window.scrollX - 100}px`;
            dd.style.position = "absolute";
            dd.querySelectorAll("li")[0].onclick = () => iniciarEdicion(c.id, c.mensaje);
            dd.querySelectorAll("li")[1].onclick = () => eliminarComentario(c.id);
            document.body.appendChild(dd);
            document.addEventListener("click", () => dd.remove(), {once:true});
        };
    }
    return div;
}

async function cargarComentarios() {
    try {
        const res = await fetch("/comentarios");
        if(!res.ok) return;
        const data = await res.json();
        chatBox.innerHTML = "";
        data.forEach(c => chatBox.appendChild(renderComentario(c)));
        chatBox.scrollTop = chatBox.scrollHeight;
    } catch(e) { console.error(e); }
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
        }
    } catch(e) { showMessage("Error de red", true); }
};

async function eliminarComentario(id) {
    if(!confirm("¿Eliminar comentario?")) return;
    try {
        const res = await fetch(`/comentarios/${id}`, {method:"DELETE"});
        if(res.ok) {
            const el = document.getElementById(`msg-${id}`);
            el.style.opacity = '0';
            el.style.transform = 'scale(0.9)';
            setTimeout(() => { el.remove(); showMessage("Eliminado"); }, 300);
        }
    } catch(e) { showMessage("Error al eliminar", true); }
}

cargarComentarios();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/static/js/service-worker-comentarios.js').then(() => console.log('SW registrado')).catch(console.error));
}