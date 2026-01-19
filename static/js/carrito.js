let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 5;

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

function mostrarModalUsuario(u) {
    const modalEl = document.createElement("div");
    modalEl.className = "modal fade";
    modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-0 rounded-4">
                <div class="modal-body text-center p-4">
                    <img src="${u.imagen_usuario || 'https://via.placeholder.com/100'}" class="rounded-circle mb-3 shadow-sm" width="100" height="100" style="object-fit:cover;">
                    <h5 class="fw-bold mb-1">${u.nombre_cliente}</h5>
                    <p class="text-muted small mb-3">${u.correo}</p>
                    <div class="text-start bg-light p-3 rounded-3">
                        <p class="mb-1 small"><strong>Cédula:</strong> ${u.cedula}</p>
                        <p class="mb-0 small"><strong>Teléfono:</strong> ${u.telefono}</p>
                    </div>
                </div>
            </div>
        </div>`;
    document.body.appendChild(modalEl);
    const m = new bootstrap.Modal(modalEl);
    m.show();
    modalEl.addEventListener("hidden.bs.modal", () => modalEl.remove());
}

async function cargarCarrito() {
    const container = document.getElementById("carritoContainer");
    const btn = document.getElementById("btnFinalizarCompra");
    container.innerHTML = "";
    btn.style.display = "none";
    try {
        const res = await fetch("/obtener_carrito");
        if (!res.ok) {
            container.innerHTML = '<p class="p-5 text-center fw-bold">No se pudo cargar el carrito.</p>';
            return;
        }
        const data = await res.json();
        if (!data.productos || data.productos.length === 0) {
            container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-cart-x fs-1"></i><p class="mt-2">El carrito está vacío</p></div>';
            return;
        }

        let totalGeneral = 0;
        const tabla = document.createElement("table");
        tabla.className = "table align-middle mb-0 fade-in-item";
        tabla.innerHTML = `
            <thead><tr><th class="ps-4">Producto</th><th>Cantidad</th><th>Unitario</th><th>Subtotal</th><th class="text-center">Acción</th></tr></thead>
            <tbody></tbody>
            <tfoot class="table-light">
                <tr>
                    <td colspan="3" class="text-end fw-bold py-3">Total del Pedido:</td>
                    <td colspan="2" class="ps-3 py-3 fw-bold fs-5 text-primary" id="totalCarritoFinal"></td>
                </tr>
            </tfoot>`;
        
        container.appendChild(tabla);
        const tbody = tabla.querySelector("tbody");

        data.productos.forEach(item => {
            const sub = Number(item.precio_unitario) * Number(item.cantidad);
            totalGeneral += sub;
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td class="ps-4 py-3">
                    <div class="d-flex align-items-center">
                        <img src="${item.imagen || 'https://via.placeholder.com/50'}" class="img-preview me-3" width="45" height="45" style="object-fit:cover; border-radius: 8px;">
                        <strong>${item.nombre_producto}</strong>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">x${item.cantidad}</span></td>
                <td>${Number(item.precio_unitario).toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                <td>${sub.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                <td class="text-center"><button class="btn btn-sm btn-outline-danger btn-quitar"><i class="bi bi-trash"></i></button></td>`;
            
            tr.querySelector(".btn-quitar").onclick = async () => {
                const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                if (r.ok) { showMessage("Eliminado"); cargarCarrito(); }
            };
            tbody.appendChild(tr);
        });

        document.getElementById("totalCarritoFinal").textContent = totalGeneral.toLocaleString('es-CO',{style:'currency',currency:'COP'});
        btn.style.display = "inline-block";
    } catch(e) { container.innerHTML = '<p class="p-5 text-center">Error de servidor.</p>'; }
}

async function finalizarCompra() {
    const res = await fetch("/finalizar_compra", { method: "POST" });
    const data = await res.json();
    if (res.ok) {
        showMessage("¡Pedido enviado!");
        cargarCarrito();
    } else {
        showMessage(data.message, true);
    }
}

document.getElementById("btnFinalizarCompra").onclick = finalizarCompra;

document.getElementById("buscarFactura").oninput = async function() {
    const val = this.value.trim();
    if (!val) { facturasActuales = []; mostrarFacturasBuscadas(); return; }
    const res = await fetch(`/buscar_facturas?cedula=${val}`);
    if (res.ok) {
        facturasActuales = (await res.json()).sort((a,b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
        paginaActual = 1;
        mostrarFacturasBuscadas();
    }
};

function mostrarFacturasBuscadas() {
    const container = document.getElementById("facturasContainer");
    container.innerHTML = "";
    const filter = document.getElementById("filtroEstado").value;
    let filtradas = facturasActuales;
    if (filter && filter !== "Todos") filtradas = facturasActuales.filter(f => f.estado === filter);

    const inicio = (paginaActual - 1) * itemsPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + itemsPorPagina);

    if (paginadas.length === 0) {
        container.innerHTML = '<p class="text-center p-4">No se encontraron registros.</p>';
        return;
    }

    paginadas.forEach(f => {
        const card = document.createElement("div");
        card.className = "card fade-in-item";
        let filas = "";
        let total = 0;
        (f.productos || []).forEach(p => {
            total += Number(p.subtotal);
            filas += `
                <tr>
                    <td>
                        <div class="d-flex align-items-center">
                            <img src="${p.imagen || 'https://via.placeholder.com/40'}" class="me-2 rounded shadow-sm" width="35" height="35" style="object-fit:cover;">
                            <span>${p.nombre_producto}</span>
                        </div>
                    </td>
                    <td>x${p.cantidad}</td>
                    <td class="text-end">${Number(p.subtotal).toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                </tr>`;
        });

        card.innerHTML = `
            <div class="invoice-header d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <img src="${f.imagen_usuario || 'https://via.placeholder.com/50'}" class="rounded-circle me-3 shadow-sm border border-2 border-white" width="45" height="45" style="object-fit:cover;">
                    <div>
                        <h6 class="fw-bold mb-0">Factura #${f.numero_factura}</h6>
                        <small class="text-muted">${new Date(f.fecha_emision).toLocaleString()}</small>
                    </div>
                </div>
                <span class="badge ${f.estado==='Anulada'?'bg-secondary':'bg-dark'}">${f.estado}</span>
            </div>
            <table class="table table-sm small table-borderless align-middle">
                <tbody>${filas}</tbody>
            </table>
            <div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
                <button class="btn btn-sm btn-link text-danger p-0 btn-anular fw-bold" ${f.estado==='Anulada'?'disabled':''} style="text-decoration:none;">Anular pedido</button>
                <div class="text-end">
                    <small class="d-block text-muted">Total pagado</small>
                    <span class="fw-bold fs-5">${total.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</span>
                </div>
            </div>`;
        
        card.querySelector(".btn-anular").onclick = async () => {
            if (await fetch(`/facturas/${f.id_factura}/anular`, { method: "PUT" })) {
                showMessage("Pedido anulado");
                f.estado = "Anulada";
                mostrarFacturasBuscadas();
            }
        };
        container.appendChild(card);
    });
    paginar(filtradas.length);
}

function paginar(total) {
    const p = document.getElementById("paginacion");
    p.innerHTML = "";
    for (let i = 1; i <= Math.ceil(total / itemsPorPagina); i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => { e.preventDefault(); paginaActual = i; mostrarFacturasBuscadas(); };
        p.appendChild(li);
    }
}

document.getElementById("filtroEstado").onchange = mostrarFacturasBuscadas;
cargarCarrito();