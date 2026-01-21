function playNotificationSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.2);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

async function cargarMarketing(){
    try {
        const res = await fetch("/api/publicidad/activa");
        const data = await res.json();
        const infoTexto = document.getElementById("infoInicioTexto");
        if(infoTexto) infoTexto.textContent = data.subtitulo || "";
        const seccionesAlFrente = document.getElementById("seccionesAlFrente");
        const seccionesDebajo = document.getElementById("seccionesDebajo");
        if(seccionesAlFrente) seccionesAlFrente.innerHTML = "";
        if(seccionesDebajo) seccionesDebajo.innerHTML = "";
        const items = data.metadata_secciones || [];
        items.forEach((item, index) => {
            const col = document.createElement("div");
            const content = `
                <div class="seccion-card text-center shadow-sm">
                    <img src="${item.url}" class="postre-imagen-seccion mb-2">
                    <h6>${item.titulo}</h6>
                    <p style="font-size: 0.85rem;">${item.descripcion}</p>
                </div>`;
            if (index < 2 && seccionesAlFrente) {
                col.className = "col-12";
                col.innerHTML = content;
                seccionesAlFrente.appendChild(col);
            } else if (index < 5 && seccionesDebajo) {
                col.className = "col-md-4";
                col.innerHTML = content;
                seccionesDebajo.appendChild(col);
            }
        });
        const carousel = document.getElementById("carouselItems");
        if(carousel) {
            carousel.innerHTML = "";
            (data.metadata_carrusel || []).forEach((item, i) => {
                const div = document.createElement("div");
                div.className = "carousel-item" + (i === 0 ? " active" : "");
                div.innerHTML = `
                    <img src="${item.url}" class="carousel-img-render">
                    <div class="caption-custom text-center">
                        <h6 class="mb-0">${item.titulo}</h6>
                        <small>${item.descripcion}</small>
                    </div>`;
                carousel.appendChild(div);
            });
        }
    } catch (error) {
        console.log("Error marketing:", error);
    }
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        document.body.appendChild(cont);
    }
    
    playNotificationSound();
    
    const t = document.createElement("div");
    t.className = "custom-toast fade-in";
    
    const textColor = isError ? '#dc3545' : '#d6336c';
    const iconClass = isError ? 'bi-x-circle-fill' : 'bi-megaphone-fill';
    
    t.innerHTML = `
        <div class="d-flex align-items-center p-1" style="width: 100%;">
            <img src="${imagen || '/static/uploads/logo.ico'}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;" class="me-3 shadow-sm">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-0">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: #333; font-size: 0.9rem;" class="mb-0">${titulo}</strong>
                </div>
                <small class="text-muted" style="font-size: 0.75rem; display: block; line-height: 1.2;">${descripcion}</small>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.7rem; color: #999;"></i>
        </div>`;
        
    cont.appendChild(t);
    
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-20px)';
        setTimeout(() => t.remove(), 400);
    };
    
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 2000);
}

async function mostrarNotificacionAleatoria(){
    try {
        const res = await fetch("/api/admin/notificaciones");
        if(res.status === 401) return;
        const data = await res.json();
        if(data && data.length > 0) {
            const aleatorio = data[Math.floor(Math.random()*data.length)];
            mostrarToastPublicidad(aleatorio.imagen_url, aleatorio.titulo, aleatorio.descripcion);
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("user");
    if (userJson) {
        const user = JSON.parse(userJson);
        const alertShown = sessionStorage.getItem("welcomeAlertShown");
        if (!alertShown) {
            const rol = user.roles?.nombre_role || user.rol || "cliente";
            const msg = rol === "admin" ? "Bienvenido Administrador" : "Bienvenido Cliente";
            mostrarToastPublicidad('/static/uploads/logo.png', "Sesión Iniciada", msg);
            sessionStorage.setItem("welcomeAlertShown", "true");
        }
    }

    cargarMarketing();
    setTimeout(mostrarNotificacionAleatoria, 1000);
    setInterval(mostrarNotificacionAleatoria, 6000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-inicio.js')
        .then(reg => {
            console.log('SW registrado correctamente');
        })
        .catch(error => {
            console.error('Error al registrar el SW:', error);
        });
    });
}