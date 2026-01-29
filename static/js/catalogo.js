const catalogoContainer = document.getElementById("catalogoProductos");
const publicidadContainer = document.getElementById("publicidadContainer");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");
const btnCarrito = document.getElementById("btnCarrito");
const badgeCarrito = document.getElementById("contadorCarritoBadge");
 
let productos = [];
let filtroIndex = 0;
let contadorCarrito = 0;
let isFirstLoad = true;
let cintaPublicitariaItems = [];
let notificacionesActivas = [];
const productosNotificados = new Set();
const filtros = ['Recientes', 'Antiguos', 'Favoritos'];
const userLogged = window.userLogged || false;

let favoritos = JSON.parse(localStorage.getItem('mis_favoritos_postres')) || [];
let audioCtx = null;

function initAudioContext() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
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
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.2);
        }

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
    } catch (e) {
        console.warn("Audio bloqueado");
    }
}

function showMessage(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
            <span>${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
    `;
    container.appendChild(toast);
    
    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };
    
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    const cont = document.getElementById("toastContainer");
    if (!cont) return;

    playNotificationSound(isError ? 'agotado' : 'default');

    const t = document.createElement("div");
    t.className = "toast show bg-dark text-white border-light mb-2";
    t.style.display = "block";
    t.style.minWidth = "320px";
    t.style.borderRadius = "12px";
    
    const textColor = isError ? '#ff4d4d' : '#e67e22';
    const iconClass = isError ? 'bi-exclamation-triangle-fill' : 'bi-stars';

    t.innerHTML = `
        <div class="d-flex align-items-center p-3">
            <img src="${imagen}" style="width:50px;height:50px;object-fit:cover;border-radius:10px;" class="me-3 shadow" onerror="this.src='/static/uploads/logo.png'">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-0">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: ${textColor}; font-size: 0.95rem;">${titulo}</strong>
                </div>
                <div style="font-size: 0.85rem; color: #e0e0e0; line-height: 1.2;">${descripcion}</div>
            </div>
            <button class="btn-close btn-close-white ms-2" style="font-size: 0.6rem;"></button>
        </div>`;
    
    cont.appendChild(t);
    
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(20px)';
        setTimeout(() => t.remove(), 500);
    };
    
    t.querySelector('.btn-close').onclick = remove;
    setTimeout(remove, 5000);
}

function mostrarToastActualizacion(imagen, titulo, descripcion, idUnico, isError = false) {
    if (productosNotificados.has(idUnico)) return;
    productosNotificados.add(idUnico);
    mostrarToastPublicidad(imagen, titulo, descripcion, isError);
    setTimeout(() => {
        productosNotificados.delete(idUnico);}, 7000);
}

async function sincronizarContadorCarrito() {
    try {
        const res = await fetch("/obtener_carrito");
        if (!res.ok) throw new Error("Status error");
        const data = await res.json();
        if (data && data.productos) {
            const nuevoTotal = data.productos.reduce((total, item) => total + item.cantidad, 0);
            contadorCarrito = nuevoTotal;
            localStorage.setItem('cant_carrito', contadorCarrito);
            actualizarContadorCarrito(0);
        }
    } catch (e) {
        const guardado = localStorage.getItem('cant_carrito');
        if (guardado) {
            contadorCarrito = parseInt(guardado);
            actualizarContadorCarrito(0);
        }
    }
}

function actualizarContadorCarrito(cantidad) {
    let guardado = localStorage.getItem('cant_carrito');
    let totalActual = guardado ? parseInt(guardado) : 0;
    
    contadorCarrito = totalActual + cantidad;
    if (contadorCarrito < 0) contadorCarrito = 0;
    
    localStorage.setItem('cant_carrito', contadorCarrito);
    
    if (badgeCarrito) {
        if (contadorCarrito > 0) {
            badgeCarrito.style.display = "flex";
            badgeCarrito.textContent = contadorCarrito;
        } else {
            badgeCarrito.style.display = "none";
        }
    }
}

async function cargarCintaPublicitaria() {
    if (!publicidadContainer) return;
    try {
        const res = await fetch("/api/publicidad/activa");
        if (!res.ok) throw new Error("Network error");
        const data = await res.json();
        if (!Array.isArray(data)) return;

        notificacionesActivas = data.filter(item => item.tipo === 'notificacion' && item.estado);
        const itemsCinta = data.filter(item => item.tipo === 'cinta' && item.estado);

        if (itemsCinta.length > 0) {
            cintaPublicitariaItems = itemsCinta;
            publicidadContainer.innerHTML = `
                <div class="promo-banner shadow-sm overflow-hidden">
                    <div class="marquee-content">
                        ${itemsCinta.concat(itemsCinta).map(item => `
                            <div class="promo-item mx-5 d-flex align-items-center" style="min-width: max-content;">
                                <img src="${item.imagen_url || '/static/uploads/logo.png'}" 
                                     class="me-3 rounded-circle border border-2 border-warning shadow-sm" 
                                     style="width: 45px; height: 45px; object-fit: cover;"
                                     onerror="this.src='/static/uploads/logo.png'">
                                <span class="text-white fw-bold" style="font-size: 0.95rem; letter-spacing: 0.5px; text-transform: uppercase;">
                                    ${item.titulo || ''}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>`;
            publicidadContainer.classList.remove("d-none");
        } else {
            publicidadContainer.innerHTML = "";
            publicidadContainer.classList.add("d-none");
        }
    } catch (e) {
        publicidadContainer.classList.add("d-none");
    }
}

function iniciarNotificacionesCintaPeriodicas() {
    setInterval(() => {
        if (notificacionesActivas.length > 0) {
            const elegido = notificacionesActivas[Math.floor(Math.random() * notificacionesActivas.length)];
            mostrarToastPublicidad(
                elegido.imagen_url || '/static/uploads/logo.png', 
                elegido.titulo, 
                elegido.descripcion
            );
        }
    }, 20000);
}

function toggleFavorito(id) {
    const idStr = id.toString();
    const index = favoritos.indexOf(idStr);
    if (index > -1) {
        favoritos.splice(index, 1);
        showMessage("Eliminado de favoritos");
    } else {
        favoritos.push(idStr);
        showMessage("Añadido a favoritos");
    }
    localStorage.setItem('mis_favoritos_postres', JSON.stringify(favoritos));
    renderProductos(searchInput.value);
}

async function cargarProductos() {
    try {
        const res = await fetch("/obtener_catalogo");
        if (!res.ok) throw new Error("Petición fallida");
        
        const data = await res.json();
        const nuevosProductos = data.productos || [];
        let huboCambios = false;

        if (!isFirstLoad) {
            nuevosProductos.forEach(nuevo => {
                const viejo = productos.find(p => p.id_producto == nuevo.id_producto);
                if (viejo) {
                    if (viejo.stock > 0 && nuevo.stock <= 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡Agotado!", `${nuevo.nombre} se ha terminado por ahora`, `agotado-${nuevo.id_producto}`, true);
                        huboCambios = true;
                    } else if (viejo.stock <= 0 && nuevo.stock > 0) {
                        mostrarToastActualizacion(nuevo.imagen_url || '/static/uploads/logo.png', "¡De Vuelta!", `${nuevo.nombre} ya está disponible nuevamente`, `disponible-${nuevo.id_producto}`, false);
                        huboCambios = true;
                    } else if (viejo.stock !== nuevo.stock || viejo.precio !== nuevo.precio) {
                        huboCambios = true;
                    }
                }
            });
            if (nuevosProductos.length !== productos.length) huboCambios = true;
        }

        if (huboCambios || productos.length === 0 || isFirstLoad) {
            productos = nuevosProductos;
            const spinner = document.getElementById("spinner");
            if (spinner) spinner.style.display = "none";
            catalogoContainer.classList.remove("d-none");
            renderProductos(searchInput.value);
        }
        isFirstLoad = false;
    } catch (e) {
        console.error("Error silencioso:", e.message);
    }
}

function renderProductos(filterText = '') {
    catalogoContainer.innerHTML = '';
    let baseFiltrada = productos.filter(p => p.nombre.toLowerCase().includes(filterText.toLowerCase()));

    if (filtros[filtroIndex] === 'Recientes') {
        baseFiltrada.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    } else if (filtros[filtroIndex] === 'Antiguos') {
        baseFiltrada.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }

    const listaFavoritos = baseFiltrada.filter(p => favoritos.includes(p.id_producto.toString()));
    const disponibles = baseFiltrada.filter(p => p.stock > 0);
    const agotados = baseFiltrada.filter(p => p.stock <= 0);

    if (listaFavoritos.length > 0) {
        const col = document.createElement("div");
        col.className = "col-12 mb-5";
        col.innerHTML = `
            <div class="accordion border-0 shadow-sm" style="border-radius: 15px; overflow: hidden;">
                <div class="accordion-item border-0">
                    <h2 class="accordion-header">
                        <button class="accordion-button fw-bold text-dark collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapseFavoritosSec" style="background-color: #fff9f0;">
                            <i class="bi bi-heart-fill text-danger me-2"></i> TUS FAVORITOS (${listaFavoritos.length})
                        </button>
                    </h2>
                    <div id="collapseFavoritosSec" class="accordion-collapse collapse">
                        <div class="accordion-body px-0" style="background-color: #fffdfa;">
                            <div class="row g-4 px-3" id="contenedorInternoFavoritos"></div>
                        </div>
                    </div>
                </div>
            </div>`;
        catalogoContainer.appendChild(col);
        const inner = document.getElementById("contenedorInternoFavoritos");
        listaFavoritos.forEach(p => inner.appendChild(crearCardProductoHTML(p, "fav")));
    }

    if (disponibles.length > 0) {
        const headerDisp = document.createElement("div");
        headerDisp.className = "col-12 mt-2 mb-4";
        headerDisp.innerHTML = `
            <div class="seccion-titulo-contenedor">
                <h3 class="seccion-titulo"><i class="bi bi-check2-circle me-2 color-disponible"></i> Postres Disponibles</h3>
                <div class="linea-decorativa linea-disponible"></div>
            </div>
            <div class="row g-4 mt-1" id="gridDisponibles"></div>`;
        catalogoContainer.appendChild(headerDisp);
        const gridDisp = document.getElementById("gridDisponibles");
        disponibles.forEach(p => gridDisp.appendChild(crearCardProductoHTML(p, "disp")));
    }

    if (agotados.length > 0) {
        const headerAgot = document.createElement("div");
        headerAgot.className = "col-12 mt-5 mb-4";
        headerAgot.innerHTML = `
            <div class="seccion-titulo-contenedor">
                <h3 class="seccion-titulo"><i class="bi bi-x-circle me-2 color-agotado"></i> Postres Agotados</h3>
                <div class="linea-decorativa linea-disponible"></div>
            </div>
            <div class="row g-4 mt-1" id="gridAgotados"></div>`;
        catalogoContainer.appendChild(headerAgot);
        const gridAgot = document.getElementById("gridAgotados");
        agotados.forEach(p => gridAgot.appendChild(crearCardProductoHTML(p, "agot")));
    }

    if (baseFiltrada.length === 0) {
        catalogoContainer.innerHTML = '<div class="col-12 text-center py-5 text-muted">No se encontraron productos</div>';
    }
    agregarEventosProductos();
}

function crearCardProductoHTML(p, prefix = "") {
    const col = document.createElement("div");
    col.className = `col-md-6 col-lg-4 mb-2 fade-in`;
    col.dataset.id = p.id_producto;
    const isAgotado = p.stock <= 0;
    const esFav = favoritos.includes(p.id_producto.toString());
    const imgUrl = p.imagen_url || '/static/uploads/default.png';
    const uniqueId = `${prefix}-${p.id_producto}`;

    col.innerHTML = `
        <div class="card h-100 product-card shadow-sm ${isAgotado ? 'producto-gris' : ''}" style="border-radius: 24px; border: 1px solid rgba(0,0,0,0.05); transition: all 0.3s ease;">
            <div class="img-wrapper position-relative overflow-hidden" style="height: 220px; border-radius: 24px 24px 0 0;">
                <button class="btn-favorito-floating btn-fav-toggle" id="fav-btn-${uniqueId}" data-id="${p.id_producto}">
                    <i class="bi ${esFav ? 'bi-heart-fill text-danger' : 'bi-heart text-muted'}" style="font-size: 1.2rem;"></i>
                </button>
                <img src="${imgUrl}" alt="${p.nombre}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease;" onerror="this.src='/static/uploads/default.png'">
                ${isAgotado ? '<div class="letrero-agotado">AGOTADO</div>' : ''}
            </div>
            <div class="card-body p-4">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title fw-bold mb-0" style="font-size: 1.15rem; color: #1a1a1a;">${p.nombre}</h5>
                    <span class="price-tag" style="background: #fff3e0; color: #e67e22; padding: 4px 12px; border-radius: 12px; font-weight: 700;">$${p.precio.toLocaleString()}</span>
                </div>
                <div class="product-description text-muted small mb-3">${p.descripcion}</div>
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div class="stock-badge py-1 px-2 rounded-pill" style="background: ${p.stock < 5 ? '#fff1f0' : '#f6ffed'}; border: 1px solid ${p.stock < 5 ? '#ffa39e' : '#b7eb8f'};">
                        <small class="${p.stock < 5 ? 'text-danger' : 'text-success'} fw-bold"><i class="bi bi-box-seam me-1"></i>${p.stock} disponibles</small>
                    </div>
                </div>
                ${!isAgotado ? `
                    <div class="d-flex gap-2 align-items-center">
                        <div class="modern-quantity-control shadow-sm">
                            <button class="qty-btn btn-disminuir"><i class="bi bi-dash-lg"></i></button>
                            <input type="number" readonly value="1" class="cantidad">
                            <button class="qty-btn btn-aumentar"><i class="bi bi-plus-lg"></i></button>
                        </div>
                        <button class="btn btn-agregar-modern flex-grow-1"><span>Añadir</span><i class="bi bi-cart-plus ms-2"></i></button>
                    </div>
                ` : `<button class="btn btn-outline-secondary w-100 disabled rounded-pill py-2" disabled>No disponible</button>`}
            </div>
        </div>`;

    col.querySelector(".btn-fav-toggle").onclick = (e) => {
        e.preventDefault();
        toggleFavorito(p.id_producto);
    };

    return col;
}

function agregarEventosProductos() {
    catalogoContainer.querySelectorAll(".btn-agregar-modern").forEach(btn => {
        btn.onclick = async () => {
            initAudioContext();
            if (!userLogged || userLogged === "false") {
                showMessage("Inicie sesión para comprar", true);
                return;
            }

            const wrapper = btn.closest('[data-id]');
            const id_producto = wrapper.dataset.id;
            const cantidadInput = wrapper.querySelector(".cantidad");
            const cantidadPedida = parseInt(cantidadInput.value);
            const productoArray = productos.find(p => p.id_producto == id_producto);

            if (!productoArray) return;

            const originalContent = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

            try {
                const res = await fetch("/guardar_catalogo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productos: [{ id_producto, cantidad: cantidadPedida }] })
                });

                if (res.ok) {
                    productoArray.stock -= cantidadPedida;
                    actualizarContadorCarrito(cantidadPedida);
                    mostrarToastPublicidad(productoArray.imagen_url || '/static/uploads/logo.png', "¡Añadido!", `${productoArray.nombre} al carrito`);
                    renderProductos(searchInput.value);
                } else {
                    const errorData = await res.json();
                    showMessage(errorData.message || "Error al añadir", true);
                    await cargarProductos();
                }
            } catch (error) {
                showMessage("Error de conexión", true);
            } finally {
                if (btn && btn.parentNode) {
                    btn.disabled = false;
                    btn.innerHTML = originalContent;
                }
            }
        };
    });

    catalogoContainer.querySelectorAll(".btn-aumentar").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            const id = btn.closest('[data-id]').dataset.id;
            const p = productos.find(x => x.id_producto == id);
            if (p && parseInt(input.value) < p.stock) {
                input.value = parseInt(input.value) + 1;
            } else {
                showMessage("Límite alcanzado", true);
            }
        };
    });

    catalogoContainer.querySelectorAll(".btn-disminuir").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            if (parseInt(input.value) > 1) input.value = parseInt(input.value) - 1;
        };
    });
}

btnFiltrar.onclick = () => {
    filtroIndex = (filtroIndex + 1) % filtros.length;
    btnFiltrar.innerHTML = `<i class="bi bi-funnel-fill me-2"></i>${filtros[filtroIndex]}`;
    renderProductos(searchInput.value);
};

searchInput.oninput = () => renderProductos(searchInput.value);

btnCarrito.onclick = () => {
    initAudioContext();
    if (!userLogged || userLogged === "false") {
        showMessage("Inicie sesión primero", true);
        return;
    }
    btnCarrito.disabled = true;
    setTimeout(() => { window.location.href = "/carrito_page"; }, 300);
};

function resetBotonesEstado() {
    if (btnCarrito) btnCarrito.disabled = false;
}

window.onload = () => {
    cargarCintaPublicitaria().then(() => {
        iniciarNotificacionesCintaPeriodicas();
    });
    cargarProductos();
    resetBotonesEstado();
    setInterval(cargarProductos, 8000);
    setInterval(cargarCintaPublicitaria, 10000);
    if (userLogged && userLogged !== "false") {
        sincronizarContadorCarrito();
        setInterval(sincronizarContadorCarrito, 15000);
    }
};

window.onpageshow = () => resetBotonesEstado();

document.addEventListener("click", () => initAudioContext(), { once: true });

document.addEventListener("DOMContentLoaded", () => {
    const userJson = sessionStorage.getItem("user");
    if (userJson) {
        const user = JSON.parse(userJson);
        const alertShown = sessionStorage.getItem("welcomeAlertShown");
        if (!alertShown) {
            setTimeout(() => {
                mostrarToastPublicidad('/static/uploads/logo.png', `Hola, ${user.nombre || 'bienvenido'}`, "Disfruta de nuestros postres");
                sessionStorage.setItem("welcomeAlertShown", "true");
            }, 2000);
        }
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js')
        .then(() => { console.log('SW OK'); })
        .catch(() => { console.log('SW Error'); });
    });
}