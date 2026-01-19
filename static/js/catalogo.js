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

function showMessage(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-exclamation-circle text-danger' : 'bi-check2-circle text-success'} me-3 fs-5"></i>
            <span class="fw-medium">${msg}</span>
        </div>
        <i class="bi bi-x ms-3 fs-5 btn-close-toast" role="button"></i>
    `;
    toastContainer.appendChild(toast);
    const closeBtn = toast.querySelector('.btn-close-toast');
    closeBtn.onclick = () => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 400);
    };
    setTimeout(() => {
        if (toast.parentNode) {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 400);
        }
    }, 4000);
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
                            <button class="btn btn-dark flex-grow-1 btn-agregar btn-soft" ${!userLogged ? 'disabled' : ''}>
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
            if (!userLogged) { showMessage("Debes iniciar sesión", true); return; }
            const wrapper = btn.closest('[data-id]');
            const id_producto = wrapper.dataset.id;
            const stock = parseInt(wrapper.dataset.stock);
            const cantidad = parseInt(wrapper.querySelector(".cantidad").value);
            const res = await fetch("/guardar_catalogo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ productos: [{ id_producto, cantidad }] })
            });
            if (res.ok) {
                actualizarContadorCarrito(cantidad);
                wrapper.dataset.stock = stock - cantidad;
                wrapper.querySelector('.stock').textContent = stock - cantidad;
                showMessage("Producto añadido al carrito");
                if (parseInt(wrapper.dataset.stock) <= 0) renderProductos(searchInput.value);
            } else {
                showMessage("Error al añadir producto", true);
            }
        };
    });

    catalogoContainer.querySelectorAll(".btn-aumentar").forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector(".cantidad");
            const stock = parseInt(btn.closest('[data-id]').dataset.stock);
            if (parseInt(input.value) < stock) input.value = parseInt(input.value) + 1;
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
        showMessage("Error de conexión", true);
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
    if (!userLogged) { showMessage("Inicia sesión primero", true); return; }
    window.location.href = "/carrito_page";
};

window.onload = cargarProductos;