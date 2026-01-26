const chatBox = document.getElementById("chatBox");
const sendBtn = document.getElementById("sendBtn");
const mensajeInput = document.getElementById("mensajeInput");
const toastContainer = document.getElementById('toastContainer');
let editandoComentario = null;
let comentariosActuales = [];

const toastSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');

const monitorConexion = {
    intervalo: null,
    frecuencia: 30000,
    iniciar() {
        if (!USER_CONFIG.userId) return;
        this.enviarSenal();
        this.intervalo = setInterval(() => this.enviarSenal(), this.frecuencia);
    },
    detener() {
        if (this.intervalo) clearInterval(this.intervalo);
    },
    async enviarSenal() {
        try {
            await fetch("/actualizar_estado_comentarios", {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e) { console.error(e); }
    }
};

function getUserColor(userId) {
    const colors = ['#f8f9ff', '#fffcf0', '#f0fff4', '#fff5f5', '#f5faff', '#f9f0ff', '#fffaf0', '#f0f0f0'];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

function showMessage(msg, isError = false) {
    toastSound.play().catch(e => console.log("Interacción requerida para audio"));
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
            <span class="small">${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.8rem;"></i>
    `;
    toastContainer.appendChild(toast);
    const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-20px)';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function renderComentario(c) {
    const div = document.createElement("div");
    const bgColor = getUserColor(c.id_usuario);
    div.className = "message position-relative shadow-sm border rounded-4 p-3 mb-3";
    div.style.backgroundColor = bgColor;
    div.id = `msg-${c.id}`;
    div.setAttribute("data-user-id", c.id_usuario);
    
    const info = c.usuario_info || {};
    const foto = info.foto_perfil || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
    const nombre = info.nombre ? `${info.nombre} ${info.apellido || ''}` : 'Usuario';
    const fecha = new Date(c.created_at).toLocaleString('es-CO', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    
    const esMio = String(c.id_usuario) === String(USER_CONFIG.userId);
    
    const ultimaConexion = info.ultima_conexion ? new Date(info.ultima_conexion) : null;
    const esFechaLogout = ultimaConexion && ultimaConexion.getFullYear() === 2000;
    const estaConectadoRealmente = info.conectado && !esFechaLogout;
    
    const estadoClase = estaConectadoRealmente ? 'estado-conectado' : 'estado-desconectado';
    
    const likes = Array.isArray(c.likes_usuarios) ? c.likes_usuarios : [];
    const yaDiLike = likes.includes(USER_CONFIG.userId);

    div.innerHTML = `
        <div class="d-flex align-items-start">
            <div class="contenedor-foto-estado me-2 me-md-3">
                <img src="${foto}" class="rounded-circle border" width="42" height="42" style="object-fit:cover;">
                <span class="punto-estado ${estadoClase}"></span>
            </div>
            <div class="flex-grow-1 overflow-hidden">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="fw-bold text-primary text-truncate small">${nombre}</span>
                    <div class="d-flex align-items-center flex-shrink-0">
                        <span class="text-muted" style="font-size:0.7rem;">${fecha}</span>
                        ${esMio ? `<i class="bi bi-three-dots-vertical btn-options text-muted ms-2" style="cursor:pointer;"></i>` : ''}
                    </div>
                </div>
                <div class="mensaje-texto text-dark mb-2">${c.mensaje}</div>
                <div class="d-flex align-items-center">
                    <div class="btn-like" onclick="toggleLike('${c.id}')">
                        <i class="bi ${yaDiLike ? 'bi-heart-fill text-danger' : 'bi-heart text-muted'} me-1"></i>
                        <span class="small fw-bold text-muted" style="font-size: 0.8rem;">${likes.length}</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    if(esMio) {
        const btnOpt = div.querySelector(".btn-options");
        btnOpt.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll(".comentario-dropdown").forEach(d => d.remove());
            const dd = document.createElement("ul");
            dd.className = "list-group position-absolute shadow-lg comentario-dropdown";
            dd.innerHTML = `
                <li class="list-group-item list-group-item-action border-0 py-2 px-3" style="cursor:pointer; font-size: 0.85rem;">
                    <i class="bi bi-pencil me-2 text-primary"></i>Editar
                </li>
                <li class="list-group-item list-group-item-action border-0 py-2 px-3 text-danger" style="cursor:pointer; font-size: 0.85rem;">
                    <i class="bi bi-trash me-2"></i>Eliminar
                </li>
            `;
            const rect = e.target.getBoundingClientRect();
            dd.style.position = "fixed";
            dd.style.top = `${rect.bottom + 5}px`;
            dd.style.left = `${rect.left - 110}px`;
            dd.querySelectorAll("li")[0].onclick = () => iniciarEdicion(c.id, c.mensaje);
            dd.querySelectorAll("li")[1].onclick = () => ejecutarEliminacionDirecta(c.id);
            document.body.appendChild(dd);
            setTimeout(() => document.addEventListener("click", () => dd.remove(), {once:true}), 50);
        };
    }
    return div;
}

async function toggleLike(id) {
    if (!USER_CONFIG.isLogged) {
        showMessage("Debes iniciar sesión para dar like", true);
        return;
    }
    const btn = document.querySelector(`#msg-${id} .btn-like`);
    const icon = btn.querySelector('i');
    const countSpan = btn.querySelector('span');
    let count = parseInt(countSpan.innerText);
    if (icon.classList.contains('bi-heart')) {
        icon.classList.replace('bi-heart', 'bi-heart-fill');
        icon.classList.replace('text-muted', 'text-danger');
        count++;
    } else {
        icon.classList.replace('bi-heart-fill', 'bi-heart');
        icon.classList.replace('text-danger', 'text-muted');
        count--;
    }
    countSpan.innerText = count;
    try {
        const res = await fetch(`/comentarios/${id}/like`, { method: "POST" });
        if (!res.ok) cargarComentarios(); 
    } catch (e) { cargarComentarios(); }
}

async function cargarComentarios() {
    try {
        const res = await fetch("/comentarios");
        if(!res.ok) return;
        const data = await res.json();
        if (JSON.stringify(data) !== JSON.stringify(comentariosActuales)) {
            const isAtBottom = chatBox.scrollHeight - chatBox.scrollTop <= chatBox.clientHeight + 100;
            comentariosActuales = data;
            chatBox.innerHTML = "";
            comentariosActuales.forEach(c => chatBox.appendChild(renderComentario(c)));
            if(isAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
        }
    } catch(e) { console.error(e); }
}

async function ejecutarEliminacionDirecta(id) {
    try {
        const res = await fetch(`/comentarios/${id}`, {method:"DELETE"});
        if(res.ok) {
            cargarComentarios();
        }
    } catch(e) { showMessage("Error de conexión", true); }
}

function iniciarEdicion(id, msg) {
    mensajeInput.value = msg;
    editandoComentario = id;
    sendBtn.innerHTML = `<i class="bi bi-check2-all me-2"></i>Guardar`;
    mensajeInput.focus();
}

sendBtn.onclick = async () => {
    const mensaje = mensajeInput.value.trim();
    if(!mensaje) return;
    sendBtn.disabled = true;
    try {
        let url = "/comentarios", method = "POST";
        let successMsg = "Comentario publicado";
        
        if(editandoComentario) {
            url = `/comentarios/${editandoComentario}`;
            method = "PUT";
            successMsg = "Comentario actualizado";
        }
        
        const res = await fetch(url, {
            method: method,
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify({mensaje})
        });
        
        if(res.ok) {
            showMessage(successMsg);
            mensajeInput.value = "";
            editandoComentario = null;
            sendBtn.innerHTML = `<i class="bi bi-send me-2"></i>Enviar`;
            cargarComentarios();
        }
    } catch(e) { showMessage("Error al procesar", true); }
    finally { sendBtn.disabled = false; }
};

window.onload = () => {
    cargarComentarios();
    monitorConexion.iniciar();
    setInterval(cargarComentarios, 8000);
};

document.addEventListener("DOMContentLoaded", () => {
    const logoutBtn = document.getElementById("logoutBtn");
    
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            const url = logoutBtn.getAttribute("href");

            monitorConexion.detener();

            const misComentarios = document.querySelectorAll(`[data-user-id="${USER_CONFIG.userId}"] .punto-estado`);
            misComentarios.forEach(punto => {
                punto.classList.remove('estado-conectado');
                punto.classList.add('estado-desconectado');
            });

            const profileStatus = document.querySelector(".profile-status");
            if (profileStatus) {
                profileStatus.innerText = "Desconectado";
                profileStatus.style.color = "#6c757d";
            }

            window.location.href = url;
        };
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-comentarios.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}