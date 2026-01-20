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
        document.getElementById("infoInicioTexto").textContent = data.subtitulo || "";
        const seccionesAlFrente = document.getElementById("seccionesAlFrente");
        const seccionesDebajo = document.getElementById("seccionesDebajo");
        seccionesAlFrente.innerHTML = "";
        seccionesDebajo.innerHTML = "";
        const items = data.metadata_secciones || [];
        items.forEach((item, index) => {
            const col = document.createElement("div");
            const content = `
                <div class="seccion-card text-center shadow-sm">
                    <img src="${item.url}" class="postre-imagen-seccion mb-2">
                    <h6>${item.titulo}</h6>
                    <p style="font-size: 0.85rem;">${item.descripcion}</p>
                </div>`;
            if (index < 2) {
                col.className = "col-12";
                col.innerHTML = content;
                seccionesAlFrente.appendChild(col);
            } else if (index < 5) {
                col.className = "col-md-4";
                col.innerHTML = content;
                seccionesDebajo.appendChild(col);
            }
        });
        const carousel = document.getElementById("carouselItems");
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
    } catch (error) {
        console.log("Modo offline: Cargando desde caché");
    }
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    const cont = document.getElementById("toastContainer");
    if (!cont) return;

    playNotificationSound();

    const t = document.createElement("div");
    t.className = "toast show bg-dark text-white border-light mb-2";
    t.style.display = "block";
    t.style.minWidth = "320px";
    
    const textColor = isError ? '#dc3545' : '#198754';
    const iconClass = isError ? 'bi-x-circle-fill' : 'bi-check-circle-fill';

    t.innerHTML = `
        <div class="d-flex align-items-center p-2">
            <img src="${imagen}" style="width:55px;height:55px;object-fit:cover;border-radius:8px;" class="me-3 shadow-sm">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-1">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: ${textColor};" class="mb-0">${titulo}</strong>
                </div>
                <small class="text-white-50">${descripcion}</small>
            </div>
            <button class="btn-close btn-close-white ms-2" style="font-size: 0.7rem;"></button>
        </div>`;

    cont.appendChild(t);

    const remove = () => {
        t.style.opacity = '0';
        t.style.transition = 'opacity 0.5s ease';
        setTimeout(() => t.remove(), 500);
    };

    t.querySelector('.btn-close').onclick = remove;
    setTimeout(remove, 3000);
}

async function mostrarNotificacionAleatoria(){
    try {
        const res = await fetch("/api/admin/notificaciones");
        const data = await res.json();
        if(data && data.length > 0) {
            const aleatorio = data[Math.floor(Math.random()*data.length)];
            mostrarToastPublicidad(aleatorio.imagen_url, aleatorio.titulo, aleatorio.descripcion);
        }
    } catch (e) {}
}

document.addEventListener("DOMContentLoaded", () => {
    cargarMarketing();
    setTimeout(mostrarNotificacionAleatoria, 1000);
    setInterval(mostrarNotificacionAleatoria, 15000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/static/js/service-worker-inicio.js').then(() => console.log('SW registrado')).catch(console.error));
}
