const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");
const btnCarrito = document.getElementById("btnCarrito");
const badgeCarrito = document.getElementById("contadorCarritoBadge");

let productos = [];
let filtroIndex = 0;
let contadorCarrito = 0;
const filtros = ['Recientes', 'Antiguos'];
const userLogged = window.userLogged || false;

function playNotificationSound() {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.2);
}

function showMessage(msg, isError = false) {
    const container = document.getElementById('toastContainer');
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

async function mostrarNotificacionAleatoria() {
    try {
        const res = await fetch("/api/admin/notificaciones");
        const data = await res.json();
        if (data && data.length > 0) {
            const aleatorio = data[Math.floor(Math.random() * data.length)];
            mostrarToastPublicidad(aleatorio.imagen_url, aleatorio.titulo, aleatorio.descripcion);
        }
    } catch (e) {}
}

function actualizarContadorCarrito(cantidad) {
    contadorCarrito += cantidad;
    if (contadorCarrito < 0) contadorCarrito = 0;
    if (contadorCarrito > 0) {
        badgeCarrito.style.display = "flex";
        badgeCarrito.textContent = contadorCarrito;
    } else {
        badgeCarrito.style.display = "none";
    }
}

function renderProductos(filterText = '') {
    catalogoContainer.innerHTML = '';
    const filtrados = productos.filter(p => p.nombre.toLowerCase().includes(filterText.toLowerCase()));
    const disponibles = filtrados.filter(p => p.stock > 0);
    const agotados = filtrados.filter(p => p.stock <= 0);
    const ordenados = [...disponibles, ...agotados];

    ordenados.forEach(p => {
        const col = document.createElement("div");
        col.className = `col-md-6 col-lg-4 mb-2 fade-in`;
        col.dataset.id = p.id_producto;
        col.dataset.stock = p.stock;
        const imgUrl = p.imagen_url || '/static/uploads/default.png';
        const isAgotado = p.stock <= 0;
        
        col.innerHTML = `
            <div class="card h-100 product-card shadow-sm ${isAgotado ? 'agotado-overlay' : ''}">
                <div class="img-wrapper">
                    <img src="${imgUrl}" alt="${p.nombre}">
                </div>
                <div class="card-body p-4">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title fw-bold mb-0">${p.nombre}</h5>
                        <span class="price-tag">$${p.precio.toLocaleString()}</span>
                    </div>
                    <p class="text-muted small mb-3">${p.descripcion}</p>
                    <div class="d-flex justify-content-between align-items-center">
                        <small class="fw-bold">Stock: <span class="stock">${p.stock}</span></small>
                        ${isAgotado ? '<span class="agotado-badge">Agotado</span>' : ''}
                    </div>
                    ${!isAgotado ? `
                        <div class="mt-4 d-flex gap-2">
                            <div class="quantity-control border">
                                <button class="btn btn-sm btn-disminuir"><i class="bi bi-dash"></i></button>
                                <input type="number" readonly value="1" class="cantidad">
                                <button class="btn btn-sm btn-aumentar"><i class="bi bi-plus"></i></button>
                            </div>
                            <button class="btn btn-dark flex-grow-1 btn-agregar btn-soft">
                                <i class="bi bi-cart-plus me-2"></i>Añadir
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>`;
        catalogoContainer.appendChild(col);
    });
    agregarEventosProductos();
}

function agregarEventosProductos() {
    catalogoContainer.querySelectorAll(".btn-agregar").forEach(btn => {
        btn.onclick = async () => {
            if (!userLogged || userLogged === "false") {
                showMessage("Inicie sesión primero para añadir productos", true);
                return;
            }
            const wrapper = btn.closest('[data-id]');
            const id_producto = wrapper.dataset.id;
            const stock = parseInt(wrapper.dataset.stock);
            const cantidad = parseInt(wrapper.querySelector(".cantidad").value);
            try {
                const res = await fetch("/guardar_catalogo", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ productos: [{ id_producto, cantidad }] })
                });
                if (res.ok) {
                    actualizarContadorCarrito(cantidad);
                    const nuevoStock = stock - cantidad;
                    wrapper.dataset.stock = nuevoStock;
                    wrapper.querySelector('.stock').textContent = nuevoStock;
                    showMessage("Producto añadido al carrito");
                    if (nuevoStock <= 0) renderProductos(searchInput.value);
                } else {
                    showMessage("No se pudo añadir el producto", true);
                }
            } catch (error) {
                showMessage("Error de conexión con el servidor", true);
            }
        };
    });

    catalogoContainer.querySelectorAll(".btn-aumentar").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            const stock = parseInt(btn.closest('[data-id]').dataset.stock);
            if (parseInt(input.value) < stock) {
                input.value = parseInt(input.value) + 1;
            } else {
                showMessage("Límite de stock alcanzado", true);
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

async function cargarProductos() {
    try {
        const res = await fetch("/obtener_catalogo");
        const data = await res.json();
        productos = data.productos || [];
        document.getElementById("spinner").style.display = "none";
        catalogoContainer.classList.remove("d-none");
        renderProductos();
    } catch (e) {
        showMessage("Error al cargar el catálogo", true);
    }
}

btnFiltrar.onclick = () => {
    filtroIndex = (filtroIndex + 1) % filtros.length;
    btnFiltrar.innerHTML = `<i class="bi bi-filter-left me-2"></i>${filtros[filtroIndex]}`;
    productos.sort((a, b) => filtroIndex === 0 ? new Date(b.fecha) - new Date(a.fecha) : new Date(a.fecha) - new Date(b.fecha));
    renderProductos(searchInput.value);
};

searchInput.oninput = () => renderProductos(searchInput.value);

btnCarrito.onclick = () => {
    if (!userLogged || userLogged === "false") {
        showMessage("Inicie sesión primero para ver su carrito", true);
        return;
    }
    window.location.href = "/carrito_page";
};

window.onload = () => {
    cargarProductos();
    setTimeout(mostrarNotificacionAleatoria, 1000);
    setInterval(mostrarNotificacionAleatoria, 15000);
};