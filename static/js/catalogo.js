const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");
const btnCarrito = document.getElementById("btnCarrito");
const badgeCarrito = document.getElementById("contadorCarritoBadge");

let productos = [];
let filtroIndex = 0;
let contadorCarrito = 0;
const filtros = ['Recientes','Antiguos'];
const userLogged = window.userLogged || false;

function showMessage(msg, isError = false) {
  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-bg-light border-0';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `<div class="d-flex">
    <div class="toast-body">${isError ? '❌' : '✅'} ${msg}</div>
    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`;
  toastContainer.appendChild(toastEl);
  const bsToast = new bootstrap.Toast(toastEl, { delay: 800 });
  bsToast.show();
  toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
}

function actualizarContadorCarrito(cantidad) {
  contadorCarrito += cantidad;
  if (contadorCarrito < 0) contadorCarrito = 0;
  btnCarrito.setAttribute("data-count", contadorCarrito);
  if (contadorCarrito > 0) {
    badgeCarrito.style.display = "inline-block";
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

  ordenados.forEach(producto => {
    const col = document.createElement("div");
    col.className = "col-md-6 col-lg-4 mb-4";
    col.dataset.id = producto.id_producto;
    col.dataset.stock = producto.stock;
    const imgUrl = producto.imagen_url || '/uploads/default.png';
    col.innerHTML = `
      <div class="card h-100">
        <img src="${imgUrl}" class="card-img-top" alt="${producto.nombre}">
        <div class="card-body">
          <h5 class="card-title">${producto.nombre}</h5>
          <p class="fw-bold">Stock: <span class="stock">${producto.stock}</span></p>
          <p class="card-text">${producto.descripcion}</p>
          <p class="fw-bold">$${producto.precio.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          ${producto.stock <= 0
            ? '<div class="agotado-label">Agotado</div>'
            : `<div class="quantity-control">
                <button class="btn btn-sm btn-outline-secondary btn-disminuir">-</button>
                <input type="number" min="0" max="${producto.stock}" value="1" class="form-control form-control-sm cantidad" style="width:60px;">
                <button class="btn btn-sm btn-outline-secondary btn-aumentar">+</button>
              </div>
              <button class="btn btn-primary mt-2 btn-agregar" ${!userLogged ? 'disabled' : ''}>Agregar al Carrito</button>`}
        </div>
      </div>`;
    catalogoContainer.appendChild(col);
  });
  agregarEventosProductos();
}

function actualizarProductoEnCatalogo(id_producto, nuevoStock) {
  const cardWrapper = [...catalogoContainer.children].find(c => c.dataset.id == id_producto);
  if (!cardWrapper) return;
  const cardBody = cardWrapper.querySelector('.card-body');
  cardWrapper.dataset.stock = nuevoStock;
  cardWrapper.querySelector('.stock').textContent = nuevoStock;
  const agregarBtn = cardBody.querySelector('.btn-agregar');
  const quantityControl = cardBody.querySelector('.quantity-control');

  if (nuevoStock <= 0) {
    if (quantityControl) quantityControl.remove();
    if (agregarBtn) agregarBtn.remove();
    if (!cardBody.querySelector('.agotado-label')) {
      const agotadoDiv = document.createElement('div');
      agotadoDiv.className = 'agotado-label';
      agotadoDiv.textContent = 'Agotado';
      cardBody.appendChild(agotadoDiv);
    }
    catalogoContainer.appendChild(cardWrapper);
  } else {
    if (quantityControl) quantityControl.querySelector('input').max = nuevoStock;
  }
}

function agregarEventosProductos() {
  catalogoContainer.querySelectorAll(".btn-agregar").forEach(btn => {
    btn.addEventListener("click", async e => {
      e.stopPropagation();
      if (!userLogged) { showMessage("Inicie sesión para agregar productos", true); return; }

      const card = btn.closest(".card");
      const wrapper = btn.closest('[data-id]');
      let stock = parseInt(wrapper.dataset.stock);

      if (stock <= 0) { showMessage("No hay stock disponible para este producto", true); return; }

      const id_producto = wrapper.dataset.id;
      const nombre = card.querySelector(".card-title").textContent;
      let cantidadInput = card.querySelector(".cantidad");
      let cantidad = parseInt(cantidadInput.value);

      if (!cantidad || cantidad < 1) {
        showMessage("Ingrese al menos un valor", true);
        cantidadInput.value = 1;
        return;
      }

      if (cantidad > stock) cantidad = stock;
      cantidadInput.value = cantidad;

      const res = await fetch("/guardar_catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: [{ id_producto, nombre_producto: nombre, cantidad }] })
      });

      const data = await res.json();
      if (res.ok) {
        actualizarContadorCarrito(cantidad);
        const nuevoStock = stock - cantidad;
        actualizarProductoEnCatalogo(id_producto, nuevoStock);
        showMessage(data.message, false);
      } else {
        showMessage(data.error, true);
      }
    });
  });

  catalogoContainer.querySelectorAll(".btn-aumentar").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const input = btn.parentElement.querySelector(".cantidad");
      const wrapper = btn.closest('[data-id]');
      const stock = parseInt(wrapper.dataset.stock);

      if (!userLogged) { showMessage("Inicie sesión para modificar cantidad", true); return; }
      if (stock <= 0) { showMessage("No hay stock disponible para este producto", true); return; }

      let valor = parseInt(input.value) || 1;
      if (valor < stock) input.value = valor + 1;
    });
  });

  catalogoContainer.querySelectorAll(".btn-disminuir").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const input = btn.parentElement.querySelector(".cantidad");

      if (!userLogged) { showMessage("Inicie sesión para modificar cantidad", true); return; }

      let valor = parseInt(input.value) || 1;
      if (valor > 0) input.value = valor - 1;
    });
  });
}

async function cargarProductosCache() {
  const cached = localStorage.getItem('catalogoCache');
  if (cached) {
    const data = JSON.parse(cached);
    productos = data;
    renderProductos(searchInput.value);
    document.getElementById("spinner").style.display = "none";
    catalogoContainer.classList.remove("d-none");
  }

  try {
    const res = await fetch("/obtener_catalogo");
    if (!res.ok) throw new Error("Error al cargar productos");
    const data = await res.json();
    productos = data.productos || [];
    localStorage.setItem('catalogoCache', JSON.stringify(productos));
    renderProductos(searchInput.value);
    document.getElementById("spinner").style.display = "none";
    catalogoContainer.classList.remove("d-none");
  } catch (e) { showMessage("Error al cargar los productos", true); }
}

btnFiltrar.addEventListener("click", () => {
  filtroIndex = (filtroIndex + 1) % filtros.length;
  const filtroActual = filtroIndex === 0 ? 'Recientes' : 'Antiguos';
  btnFiltrar.textContent = `Filtrar: ${filtroActual}`;
  if (filtroActual === 'Recientes') { productos.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0)); }
  else { productos.sort((a, b) => new Date(a.fecha || 0) - new Date(b.fecha || 0)); }
  renderProductos(searchInput.value);
});

searchInput.addEventListener("input", () => {
  renderProductos(searchInput.value);
});

btnCarrito.addEventListener("click", () => {
  if (!userLogged) { showMessage("Inicie sesión para ver su carrito", true); return; }
  window.location.href = "/carrito_page";
});

window.addEventListener("load", cargarProductosCache);

if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/static/js/service-worker-catalogo.js').then(()=>console.log('SW registrado')).catch(console.error));
}