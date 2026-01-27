let productosMemoria = [];
let notificacionesDisponibles = [];
let isFirstLoad = true;
const productosNotificados = new Set();
let audioCtx = null;

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
}

function playNotificationSound(type = 'default') {
    try {
        initAudioContext();
        if (!audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        if (type === 'agotado') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(330, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.3);
            gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.15);
            gainNode.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.6);
        }
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) { console.warn("Audio bloqueado"); }
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    const cont = document.getElementById("toastContainer");
    if (!cont) return;

    playNotificationSound(isError ? 'agotado' : 'default');

    const t = document.createElement("div");
    t.className = "toast show bg-dark text-white border-light mb-2";
    t.style.display = "block";
    t.style.minWidth = "280px";
    t.style.maxWidth = "350px";
    t.style.borderRadius = "12px";
    t.style.transition = "all 0.5s ease";
    t.style.pointerEvents = "auto";
    
    const textColor = isError ? '#ff4d4d' : '#e67e22';
    const iconClass = isError ? 'bi-exclamation-triangle-fill' : 'bi-stars';

    t.innerHTML = `
        <div class="d-flex align-items-center p-3">
            <img src="${imagen}" style="width:45px;height:45px;object-fit:cover;border-radius:10px;" class="me-3 shadow" onerror="this.src='/static/uploads/logo.png'">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-0">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: ${textColor}; font-size: 0.9rem;">${titulo}</strong>
                </div>
                <div style="font-size: 0.8rem; color: #e0e0e0; line-height: 1.2;">${descripcion}</div>
            </div>
            <button class="btn-close btn-close-white ms-2" style="font-size: 0.6rem;"></button>
        </div>`;
    
    cont.appendChild(t);
    
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-20px)';
        setTimeout(() => t.remove(), 500);
    };
    
    t.querySelector('.btn-close').onclick = remove;
    setTimeout(remove, 6000);
}

function mostrarToastActualizacion(imagen, titulo, descripcion, idUnico, isError = false) {
    if (productosNotificados.has(idUnico)) return;
    productosNotificados.add(idUnico);
    mostrarToastPublicidad(imagen, titulo, descripcion, isError);
    setTimeout(() => { productosNotificados.delete(idUnico); }, 20000);
}

async function monitorearCambiosCatalogo() {
    try {
        const res = await fetch("/obtener_catalogo");
        const data = await res.json();
        const nuevosProductos = data.productos || [];

        if (!isFirstLoad) {
            nuevosProductos.forEach(nuevo => {
                const viejo = productosMemoria.find(p => p.id_producto == nuevo.id_producto);
                if (viejo) {
                    if (viejo.stock > 0 && nuevo.stock <= 0) {
                        mostrarToastActualizacion(
                            nuevo.imagen_url || '/static/uploads/logo.png', 
                            "¡Producto Agotado!", 
                            `Se acaba de terminar: ${nuevo.nombre}`, 
                            `agotado-${nuevo.id_producto}`, 
                            true
                        );
                    } else if (viejo.stock <= 0 && nuevo.stock > 0) {
                        mostrarToastActualizacion(
                            nuevo.imagen_url || '/static/uploads/logo.png', 
                            "¡Nueva Disponibilidad!", 
                            `${nuevo.nombre} está listo para pedir nuevamente`, 
                            `disponible-${nuevo.id_producto}`,
                            false
                        );
                    }
                }
            });
        }
        productosMemoria = nuevosProductos;
        isFirstLoad = false;
    } catch (e) { console.error("Error monitoreo:", e); }
}

async function cargarMarketing() {
    try {
        const res = await fetch("/api/publicidad/activa");
        const publicidadArray = await res.json();
        if (!Array.isArray(publicidadArray)) return;

        const seccionesAlFrente = document.getElementById("seccionesAlFrente");
        const seccionesDebajo = document.getElementById("seccionesDebajo");
        const carouselInner = document.getElementById("carouselItems");

        if (seccionesAlFrente) seccionesAlFrente.innerHTML = "";
        if (seccionesDebajo) seccionesDebajo.innerHTML = "";
        if (carouselInner) carouselInner.innerHTML = "";

        notificacionesDisponibles = publicidadArray.filter(item => item.tipo === 'notificacion');

        publicidadArray.forEach((item, index) => {
            if (item.tipo === 'seccion') {
                const delay = (index * 0.15).toFixed(2);
                const cardHtml = `
                    <div class="seccion-card shadow-sm h-100 w-100" style="animation: fadeInSmooth 0.8s ease forwards; animation-delay: ${delay}s">
                        <img src="${item.imagen_url || '/static/img/placeholder.png'}" class="postre-imagen-seccion w-100" onerror="this.src='/static/img/placeholder.png'">
                        <div class="p-3 d-flex flex-column flex-grow-1">
                            <h6 class="fw-bold mb-1" style="color: #d6336c; font-size: 1.1rem;">${item.titulo || ''}</h6>
                            <p class="text-muted mb-0 small" style="line-height: 1.5;">${item.descripcion || ''}</p>
                        </div>
                    </div>`;

                if (seccionesAlFrente && seccionesAlFrente.children.length < 2) {
                    const wrap = document.createElement("div");
                    wrap.className = "w-100 mb-3";
                    wrap.innerHTML = cardHtml;
                    seccionesAlFrente.appendChild(wrap);
                } else if (seccionesDebajo) {
                    const col = document.createElement("div");
                    col.className = "col-6 col-md-4 col-lg-3 mb-4";
                    col.innerHTML = cardHtml;
                    seccionesDebajo.appendChild(col);
                }
            }

            if (item.tipo === 'carrusel' && carouselInner) {
                const div = document.createElement("div");
                div.className = `carousel-item ${carouselInner.children.length === 0 ? 'active' : ''}`;
                div.innerHTML = `
                    <div class="carousel-img-wrapper">
                        <img src="${item.imagen_url}" class="carousel-background-blur">
                        <img src="${item.imagen_url}" class="d-block carousel-img-render">
                        <div class="carousel-overlay"></div>
                    </div>
                    <div class="carousel-caption-custom">
                        <h6 class="carousel-title-animate">${item.titulo || ''}</h6>
                        <div class="carousel-divider"></div>
                        <p class="carousel-desc-animate">${item.descripcion || ''}</p>
                    </div>`;
                carouselInner.appendChild(div);
            }
        });

        if (carouselInner && carouselInner.children.length > 0) {
            new bootstrap.Carousel(document.getElementById('carouselPromo'), { 
                interval: 6000, 
                ride: 'carousel', 
                pause: false 
            });
        }
    } catch (e) { console.error("Error al cargar publicidad", e); }
}

document.addEventListener("DOMContentLoaded", () => {
    cargarMarketing().then(() => {
        setInterval(() => {
            if (notificacionesDisponibles.length > 0) {
                const indiceAleatorio = Math.floor(Math.random() * notificacionesDisponibles.length);
                const e = notificacionesDisponibles[indiceAleatorio];
                mostrarToastPublicidad(e.imagen_url, e.titulo, e.descripcion);
            }
        }, 8000);
    });

    monitorearCambiosCatalogo();
    setInterval(monitorearCambiosCatalogo, 8000);
});

document.addEventListener("click", () => { initAudioContext(); }, { once: true });

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
        .then(() => { console.log('SW OK'); })
        .catch(() => { console.log('SW Error'); });
    });
}