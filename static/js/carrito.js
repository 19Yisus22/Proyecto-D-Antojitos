let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 5;

function showMessage(msg, isError = false) {
    const toastContainer = document.getElementById('toastContainer');
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role', 'alert');
    toastEl.setAttribute('aria-live', 'assertive');
    toastEl.setAttribute('aria-atomic', 'true');
    toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${isError ? '❌' : '✅'} ${msg}</div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl, { delay: 1500 }).show();
}

function mostrarModalUsuario(usuario) {
    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content p-3">
                <div class="modal-header">
                    <h5 class="modal-title">Información del Usuario</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${usuario.imagen_usuario || 'https://via.placeholder.com/120'}" alt="Usuario" class="rounded-circle mb-3" width="120" height="120" style="object-fit:cover;">
                    <div class="card p-3">
                        <p><strong>Nombre:</strong> ${usuario.nombre_cliente || ''}</p>
                        <p><strong>Teléfono:</strong> ${usuario.telefono || ''}</p>
                        <p><strong>Correo:</strong> ${usuario.correo || ''}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());
}

function mostrarModalProducto(producto) {
    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.tabIndex = -1;
    modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content p-3">
                <div class="modal-header">
                    <h5 class="modal-title">Información del Producto</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center">
                    <img src="${producto.imagen || 'https://via.placeholder.com/200'}" alt="${producto.nombre_producto}" class="mb-3" width="200" height="200" style="object-fit:cover;">
                    <div class="card p-3">
                        <p><strong>Nombre:</strong> ${producto.nombre_producto || ''}</p>
                        <p><strong>Descripción:</strong> ${producto.descripcion || 'Sin descripción disponible'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());
}

function mostrarFactura(data, mostrarFoto = false) {
    const contenedor = document.getElementById("facturaContainer");
    const productos = data.productos || [];
    const div = document.createElement("div");
    div.className = "card mb-3 p-3";

    let filas = "";
    let totalSubtotal = 0;
    productos.forEach(p => {
        const subtotal = Number(p.subtotal || 0);
        totalSubtotal += subtotal;
        filas += `<tr>
            <td>${p.nombre_producto}</td>
            <td>x${p.cantidad}</td>
            <td>${subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
        </tr>`;
    });

    div.innerHTML = `
        <div class="d-flex align-items-center mb-2">
            ${mostrarFoto ? `<img src="${data.imagen_usuario || 'https://via.placeholder.com/60'}" alt="Usuario" class="rounded-circle me-3 perfil-click" width="60" height="60" style="cursor:pointer;">` : ''}
            <div>
                <strong>#${data.id_pedido || 'N/A'}</strong><br>
                Cliente: ${data.nombre_cliente || ''}<br>
                Cédula: ${data.cedula || ''}<br>
                Dirección: ${data.direccion_entrega || ''}<br>
                ${''}<br>
            </div>
        </div>
        <table class="table table-sm table-bordered text-center">
            <thead class="table-dark">
                <tr>
                    <th>Producto</th>
                    <th>Cantidad</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        <p class="text-end fw-bold">Total: ${totalSubtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
        <p><strong>Método de Pago:</strong> ${data.metodo_pago || ''}</p>
    `;
    contenedor.prepend(div);

    const fotoPerfil = div.querySelector(".perfil-click");
    if (fotoPerfil) {
        fotoPerfil.addEventListener("click", () => mostrarModalUsuario(data));
    }
}

async function generarFactura() {
    try {
        const res = await fetch("/finalizar_compra", { method: "POST" });
        const data = await res.json();
        if (res.ok) {
            showMessage(data.message || "Pedido Enviado");
            mostrarFactura(data, false);
            cargarCarrito();
        } else {
            showMessage(data.message || "Error al finalizar compra", true);
        }
    } catch (e) {
        showMessage("Error al finalizar compra", true);
    }
}

document.getElementById("btnFinalizarCompra").addEventListener("click", generarFactura);

async function cargarCarrito() {
    const contenedor = document.getElementById("carritoContainer");
    const botonFinal = document.getElementById("btnFinalizarCompra");
    contenedor.innerHTML = "";
    botonFinal.style.display = "none";
    try {
        const res = await fetch("/obtener_carrito");
        if (res.status === 401 || res.status === 403) {
            contenedor.innerHTML = '<p class="text-center fw-bold fs-4 mt-4 text-danger">Inicie sesión para ver su carrito</p>';
            document.querySelectorAll("button, input, textarea").forEach(el => el.disabled = true);
            return;
        }
        const data = await res.json();
        if (!data.productos || data.productos.length === 0) {
            contenedor.innerHTML = '<p class="text-center fw-bold fs-4 mt-4 text-danger">El carrito está vacío</p>';
            return;
        }
        const productosAgrupados = {};
        data.productos.forEach(item => {
            if (productosAgrupados[item.id_producto]) {
                productosAgrupados[item.id_producto].cantidad += item.cantidad;
            } else {
                productosAgrupados[item.id_producto] = { ...item };
            }
        });
        const tabla = document.createElement("table");
        tabla.className = "table table-bordered text-center align-middle";
        tabla.innerHTML = `<thead class="table-dark">
            <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unitario</th>
                <th>Subtotal</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody></tbody>
        <tfoot>
            <tr>
                <th colspan="3" class="text-end">Total</th>
                <th id="totalCarrito">COP 0</th>
                <th></th>
            </tr>
        </tfoot>`;
        contenedor.appendChild(tabla);
        const tbody = tabla.querySelector("tbody");
        let total = 0;
        Object.values(productosAgrupados).forEach(item => {
            const subtotal = Number(item.precio_unitario || 0) * Number(item.cantidad || 0);
            total += subtotal;
            const tr = document.createElement("tr");
            tr.dataset.id = item.id_carrito;
            tr.innerHTML = `<td class="d-flex flex-column align-items-center">
                                <img src="${item.imagen || 'https://via.placeholder.com/70'}" class="img-preview mb-1 producto-click" alt="${item.nombre_producto}" width="70" height="70" style="cursor:pointer;">
                                <div>${item.nombre_producto}</div>
                            </td>
                            <td>x${item.cantidad}</td>
                            <td>${Number(item.precio_unitario).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                            <td>${subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
                            <td><button class="btn btn-danger btn-sm btn-quitar">Eliminar Items</button></td>`;
            tr.querySelector(".btn-quitar").addEventListener("click", async () => {
                const delRes = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                if (delRes.ok) {
                    tr.remove();
                    showMessage("Productos eliminados");
                    if (tbody.children.length === 0) {
                        contenedor.innerHTML = '<p class="text-center fw-bold fs-4 mt-4 text-danger">Su carrito está vacío</p>';
                        botonFinal.style.display = "none";
                    } else {
                        let nuevoTotal = 0;
                        Array.from(tbody.children).forEach(r => {
                            nuevoTotal += Number(r.children[3].textContent.replace(/[^\d]/g, ''));
                        });
                        document.getElementById("totalCarrito").textContent = nuevoTotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
                    }
                } else {
                    showMessage("No se pudo eliminar el producto", true);
                }
            });
            const imgPreview = tr.querySelector(".producto-click");
            imgPreview.addEventListener("click", () => mostrarModalProducto(item));
            tbody.appendChild(tr);
        });
        document.getElementById("totalCarrito").textContent = total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
        botonFinal.style.display = "block";
    } catch (e) {
        contenedor.innerHTML = '<p class="text-center fw-bold fs-4 mt-4 text-danger">Error al cargar el carrito. Intente nuevamente.</p>';
    }
}

document.getElementById("buscarFactura").addEventListener("input", async function () {
    const query = this.value.trim();
    if (query.length === 0) {
        facturasActuales = [];
        mostrarFacturas();
        return;
    }
    try {
        const res = await fetch(`/buscar_facturas?cedula=${encodeURIComponent(query)}`);
        if (res.ok) {
            let data = await res.json();
            facturasActuales = (data || []).sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
            paginaActual = 1;
            mostrarFacturasBuscadas();
        } else {
            facturasActuales = [];
            mostrarFacturasBuscadas();
            showMessage("No se pudieron obtener facturas", true);
        }
    } catch (e) {
        facturasActuales = [];
        mostrarFacturasBuscadas();
        showMessage("Error al buscar facturas", true);
    }
});

function mostrarFacturasBuscadas() {
    const contenedor = document.getElementById("facturasContainer");
    contenedor.innerHTML = "";
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    const facturasPage = facturasActuales.slice(inicio, fin);

    if (facturasPage.length === 0) {
        contenedor.innerHTML = '<p class="text-center fw-bold fs-5 mt-4">No se encontraron facturas</p>';
        document.getElementById("paginacion").innerHTML = '';
        return;
    }

    facturasPage.forEach(f => {
        const div = document.createElement("div");
        div.className = "card mb-3 p-3";

        let filas = "";
        let totalSubtotal = 0;
        (f.productos || []).forEach(prod => {
            const subtotal = Number(prod.subtotal || 0);
            totalSubtotal += subtotal;
            filas += `<tr>
                <td>${prod.nombre_producto}</td>
                <td>x${prod.cantidad}</td>
                <td>${subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
            </tr>`;
        });

        div.innerHTML = `
            <div class="d-flex align-items-center mb-2">
                <img src="${f.imagen_usuario || 'https://via.placeholder.com/60'}" alt="Usuario" class="rounded-circle me-3 perfil-click" width="60" height="60" style="cursor:pointer;">
                <div>
                    <strong>#${f.numero_factura}</strong><br>
                    Cliente: ${f.nombre_cliente}<br>
                    Cédula: ${f.cedula}<br>
                    Estado: <span class="fw-bold">${f.estado}</span>
                </div>
            </div>
            <table class="table table-sm table-bordered text-center">
                <thead class="table-dark">
                    <tr>
                        <th>Producto</th>
                        <th>Cantidad</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>
            <p class="text-end fw-bold">Total: ${totalSubtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</p>
            <p><strong>Método de Pago:</strong> ${f.metodo_pago || ''}</p>
            <p><strong>Fecha Emisión:</strong> ${new Date(f.fecha_emision).toLocaleString('es-CO')}</p>
        `;
        contenedor.appendChild(div);

        const fotoPerfil = div.querySelector(".perfil-click");
        if (fotoPerfil) {
            fotoPerfil.addEventListener("click", () => mostrarModalUsuario(f));
        }
    });

    paginarFacturas();
}

function paginarFacturas() {
    const totalPaginas = Math.ceil(facturasActuales.length / itemsPorPagina);
    const pagContainer = document.getElementById("paginacion");
    pagContainer.innerHTML = "";
    for (let i = 1; i <= totalPaginas; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener("click", e => {
            e.preventDefault();
            paginaActual = i;
            if (document.getElementById("buscarFactura").value.trim().length > 0) {
                mostrarFacturasBuscadas();
            } else {
                mostrarFacturas();
            }
        });
        pagContainer.appendChild(li);
    }
}

cargarCarrito();