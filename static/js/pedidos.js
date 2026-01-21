const toastContainer = document.getElementById('toastContainer');
const alertaCancelado = document.getElementById('alertaCancelado');
const itemsPorPagina = 5;
let pedidosGlobal = [];
let pedidosFiltrados = [];
let pedidosCanceladosVerificados = JSON.parse(localStorage.getItem("pedidosCanceladosVerificados") || "[]");
let estadosPagoGuardados = JSON.parse(localStorage.getItem("estadosPagoItems") || "{}");
let cantidadPedidosAnterior = 0;
let paginaActual = 1;
let contadorFacturasPorAnio = JSON.parse(localStorage.getItem("contadorFacturasPorAnio") || "{}");

const sonidoNuevoPedido = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
sonidoNuevoPedido.volume = 0.6;

function showMessage(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-2 fs-6"></i>
            <span style="font-size: 0.85rem;">${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.65rem;"></i>
    `;
    container.appendChild(toast);
    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'custom-toast border-warning shadow-lg';
    toast.style.minWidth = "280px";
    toast.innerHTML = `
        <div class="flex-column w-100">
            <div class="d-flex align-items-center mb-2">
                <i class="bi bi-exclamation-triangle text-warning me-2 fs-6"></i>
                <span class="fw-bold" style="font-size: 0.85rem;">${msg}</span>
            </div>
            <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-sm btn-outline-secondary btn-cancel" style="font-size: 0.75rem;">Cancelar</button>
                <button class="btn btn-sm btn-danger btn-confirm" style="font-size: 0.75rem;">Confirmar</button>
            </div>
        </div>
    `;
    container.appendChild(toast);

    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-cancel').onclick = remove;
    toast.querySelector('.btn-confirm').onclick = () => {
        callback();
        remove();
    };
}

function generarNumeroFactura(idPedido, fecha) {
    const year = new Date(fecha).getFullYear();
    const key = `${year}-${idPedido}`;
    
    if (!contadorFacturasPorAnio[key]) {
        if (!contadorFacturasPorAnio[year]) {
            contadorFacturasPorAnio[year] = 0;
        }
        contadorFacturasPorAnio[year]++;
        contadorFacturasPorAnio[key] = contadorFacturasPorAnio[year];
        localStorage.setItem("contadorFacturasPorAnio", JSON.stringify(contadorFacturasPorAnio));
    }
    
    return `F-${year}-${contadorFacturasPorAnio[key]}`;
}

function normalizarTexto(texto) {
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, '');
}

function notificarNuevoPedido() {
    sonidoNuevoPedido.play().catch(() => {});
    const toast = document.createElement('div');
    toast.className = 'custom-toast bg-primary text-white';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi bi-bell-fill me-2 fs-6"></i>
            <span style="font-size: 0.85rem;"><strong>¡NUEVO PEDIDO!</strong> Se ha recibido una nueva orden.</span>
        </div>
    `;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, 5000);
}

function notificarAnulacionToast(pedidoId) {
    const idStr = String(pedidoId);
    if (pedidosCanceladosVerificados.includes(idStr)) return;
    
    const container = document.getElementById('toastContainer');
    if (container.querySelector(`[data-verificar-id="${idStr}"]`)) return;

    const toast = document.createElement('div');
    toast.className = 'custom-toast border-danger';
    toast.dataset.verificarId = idStr;
    toast.innerHTML = `
        <div class="flex-column w-100">
            <div class="d-flex align-items-center mb-2">
                <i class="bi bi-x-octagon text-danger me-2 fs-6"></i>
                <span style="font-size: 0.85rem;">Pedido <strong>#${idStr}</strong> ha sido Anulado</span>
            </div>
            <button class="btn btn-sm btn-success w-100 btn-verificar" style="font-size: 0.75rem;">Marcar como Verificado ✔</button>
        </div>
    `;
    container.appendChild(toast);

    toast.querySelector('.btn-verificar').onclick = () => {
        if (!pedidosCanceladosVerificados.includes(idStr)) {
            pedidosCanceladosVerificados.push(idStr);
            localStorage.setItem("pedidosCanceladosVerificados", JSON.stringify(pedidosCanceladosVerificados));
        }
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
            aplicarFiltros();
        }, 400);
    };
}

function renderizarPaginacion(lista) {
    const totalPaginas = Math.ceil(lista.length / itemsPorPagina) || 1;
    const pagUl = document.getElementById("pagination");
    pagUl.innerHTML = "";
    
    if (paginaActual > totalPaginas) paginaActual = totalPaginas;

    for (let i = 1; i <= totalPaginas; i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.addEventListener("click", (e) => { 
            e.preventDefault(); 
            paginaActual = i;
            mostrarPagina(lista, i);
            renderizarPaginacion(lista);
        });
        pagUl.appendChild(li);
    }
    actualizarTituloTabla();
    mostrarPagina(lista, paginaActual);
}

function mostrarPagina(lista, pagina) {
    const cont = document.getElementById("tablaPedidos");
    cont.innerHTML = "";
    const inicio = (pagina - 1) * itemsPorPagina;
    const fin = inicio + itemsPorPagina;
    lista.slice(inicio, fin).forEach(card => {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.appendChild(card);
        tr.appendChild(td);
        cont.appendChild(tr);
    });
}

function actualizarTituloTabla() {
    const titulo = document.getElementById("tituloTabla");
    const filtro = document.getElementById("filtroEstado").value;
    if (filtro === "Todos") titulo.textContent = "Pedidos Activos";
    else if (filtro === "Terminados") titulo.textContent = "Pedidos Terminados";
    else if (filtro === "Cancelado") titulo.textContent = "Pedidos Anulados (Pendientes)";
    else if (filtro === "HistorialAnulados") titulo.textContent = "Historial de Pedidos Anulados";
    else titulo.textContent = `Pedidos ${filtro}`;
}

async function cargarPedidos() {
    const res = await fetch("/obtener_pedidos");
    const pedidos = await res.json();
    if (!Array.isArray(pedidos)) return;

    if (pedidos.length > cantidadPedidosAnterior && cantidadPedidosAnterior !== 0) {
        notificarNuevoPedido();
    }
    cantidadPedidosAnterior = pedidos.length;

    pedidosGlobal = pedidos.map(pedido => {
        const facturaFormateada = generarNumeroFactura(pedido.id_pedido, pedido.fecha_pedido);
        const card = document.createElement("div");
        const esTerminado = pedido.estado === 'Entregado' && pedido.pagado;
        const esAnulado = pedido.estado === 'Cancelado';
        const bloqueado = esTerminado || esAnulado;

        card.className = "pedido-card card-collapsed col-12 mb-3 p-2 shadow-sm";
        card.dataset.cliente = normalizarTexto(pedido.usuarios?.nombre || 'desconocido');
        card.dataset.factura = normalizarTexto(facturaFormateada);
        card.dataset.estado = pedido.estado;
        card.dataset.pagado = pedido.pagado;
        card.dataset.id_real = String(pedido.id_pedido);
        card.id = `pedido-${pedido.id_pedido}`;

        let totalPedido = 0;
        let estadosPago = {};
        
        let itemsHTML = (pedido.pedido_detalle || []).map((item, idx) => {
            totalPedido += item.subtotal;
            const itemId = `${pedido.id_pedido}-${idx}`;
            
            let pagadoItem;
            if (estadosPagoGuardados[itemId] !== undefined) {
                pagadoItem = estadosPagoGuardados[itemId];
            } else {
                pagadoItem = item.pagado !== undefined ? item.pagado : pedido.pagado;
            }
            
            estadosPago[itemId] = pagadoItem;
            
            return `<tr>
        <td>${item.nombre_producto}</td>
        <td>${item.cantidad}</td>
        <td>${item.subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
        <td>
          <i class="bi ${pagadoItem ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} fs-4 toggle-pago-item ${bloqueado ? 'pe-none opacity-50' : ''}" 
             style="cursor:pointer" 
             data-item-id="${itemId}" 
             data-pagado="${pagadoItem}"></i>
        </td>
      </tr>`;
        }).join("");

        const totalFilaHTML = `
      <tr class="table-secondary fw-bold">
        <td colspan="2" class="text-end">TOTAL A PAGAR:</td>
        <td>${totalPedido.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}</td>
        <td></td>
      </tr>
    `;

        const fechaStr = pedido.fecha_pedido ? new Date(pedido.fecha_pedido).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'No registrada';
        const textoEstado = esAnulado ? 'Anulado' : pedido.estado;
        
        const totalItems = (pedido.pedido_detalle || []).length;
        const itemsPagados = Object.values(estadosPago).filter(p => p).length;
        let textoPago = '';
        
        if (itemsPagados === totalItems) {
            textoPago = 'Pago Realizado';
        } else if (itemsPagados === 0) {
            textoPago = 'Pago Pendiente';
        } else {
            textoPago = `Pago Pendiente (${totalItems - itemsPagados} restantes)`;
        }

        card.innerHTML = `
      <div class="card ${esAnulado ? 'bg-light text-muted' : ''} ${esTerminado ? 'border-success' : ''}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <img src="${pedido.usuarios?.imagen_url || '/static/uploads/default.png'}" alt="Perfil" class="rounded-circle perfil-img" style="width:40px;height:40px;object-fit:cover;cursor:pointer;">
            <div>
              <strong>Factura: ${facturaFormateada}</strong><br>
              <small>Estado: ${textoEstado} - ${textoPago} | Fecha: ${fechaStr}</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <i class="bi bi-chevron-down icono fs-4 toggle-detalle"></i>
            <i class="bi bi-trash icono text-danger fs-4" onclick="this.closest('.pedido-card').classList.toggle('seleccion');"></i>
          </div>
        </div>
        <div class="card-body">
          <p><strong>Cliente:</strong> ${(pedido.usuarios?.nombre || 'Desconocido')} ${(pedido.usuarios?.apellido || '')}</p>
          <p><strong>Cédula:</strong> ${pedido.usuarios?.cedula || 'No registrada'}</p>
          <p><strong>Dirección:</strong> ${pedido.direccion_entrega || 'No registrada'}</p>
          <p><strong>Método de Pago:</strong> ${pedido.metodo_pago || 'No especificado'}</p>
          <table class="table table-sm mt-2 align-middle text-center">
            <thead class="table-light"><tr><th>Producto</th><th>Cantidad</th><th>Subtotal</th><th>Pago</th></tr></thead>
            <tbody>${itemsHTML}${totalFilaHTML}</tbody>
          </table>
          <div class="mt-3">
            <select class="form-select estado-select" ${bloqueado ? 'disabled' : ''}>
              <option value="Pendiente" ${pedido.estado === 'Nuevo' ? 'selected' : ''}>Pendiente</option>
              <option value="Entregado" ${pedido.estado === 'Pendiente' ? 'selected' : ''}>Entregado</option>
              <option value="Cancelado" ${pedido.estado === 'Terminado' ? 'selected' : ''}>Anulado</option>
            </select>
            <button class="btn btn-primary btn-sm mt-2 actualizar-btn" ${bloqueado ? 'disabled' : ''}>Actualizar Estado</button>
          </div>
        </div>
      </div>`;

        if (esAnulado) notificarAnulacionToast(pedido.id_pedido);

        card.querySelector(".toggle-detalle").addEventListener("click", () => card.classList.toggle("card-collapsed"));

        card.querySelector(".actualizar-btn")?.addEventListener("click", async () => {
            const nuevo_estado = card.querySelector(".estado-select").value;
            const res = await fetch(`/actualizar_estado/${pedido.id_pedido}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado: nuevo_estado })
            });
            if (res.ok) {
                const labelEstado = nuevo_estado === 'Cancelado' ? 'Anulado' : nuevo_estado;
                showMessage(`Pedido ${facturaFormateada}: Estado actualizado a ${labelEstado}`);
                await cargarPedidos();
            } else {
                showMessage("Error al actualizar estado", true);
            }
        });

        if (!bloqueado) {
            const iconosPago = card.querySelectorAll(".toggle-pago-item");
            iconosPago.forEach(icon => {
                icon.addEventListener("click", async () => {
                    const itemId = icon.dataset.itemId;
                    const pagadoActual = icon.dataset.pagado === 'true';
                    const nuevoPago = !pagadoActual;
                    
                    icon.dataset.pagado = nuevoPago;
                    estadosPago[itemId] = nuevoPago;
                    estadosPagoGuardados[itemId] = nuevoPago;
                    localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));
                    
                    if (nuevoPago) {
                        icon.classList.remove('bi-x-circle', 'text-danger');
                        icon.classList.add('bi-check-circle', 'text-success');
                    } else {
                        icon.classList.remove('bi-check-circle', 'text-success');
                        icon.classList.add('bi-x-circle', 'text-danger');
                    }
                    
                    const totalItems = iconosPago.length;
                    const itemsPagados = Object.values(estadosPago).filter(p => p).length;
                    
                    const headerSmall = card.querySelector('.card-header small');
                    const estadoActual = card.querySelector('.estado-select').value;
                    const textoEstadoActual = estadoActual === 'Cancelado' ? 'Anulado' : estadoActual;
                    
                    let nuevoTextoPago = '';
                    if (itemsPagados === totalItems) {
                        nuevoTextoPago = 'Pago Realizado';
                    } else if (itemsPagados === 0) {
                        nuevoTextoPago = 'Pago Pendiente';
                    } else {
                        nuevoTextoPago = `Pago Pendiente (${totalItems - itemsPagados} restantes)`;
                    }
                    
                    headerSmall.textContent = `Estado: ${textoEstadoActual} - ${nuevoTextoPago} | Fecha: ${fechaStr}`;
                    
                    showMessage(`Item ${nuevoPago ? 'marcado como pagado' : 'marcado como pendiente'}`);
                });
            });
        }
        
        return card;
    });
    aplicarFiltros();
}

function aplicarFiltros() {
    const anioSeleccionado = document.getElementById("selectAnio").value;
    const numeroFactura = document.getElementById("inputNumeroFactura").value.trim();
    const estadoFiltro = document.getElementById("filtroEstado").value;
    
    pedidosFiltrados = pedidosGlobal.filter(card => {
        const esAnulado = card.dataset.estado === "Cancelado";
        const estaVerificado = pedidosCanceladosVerificados.includes(card.dataset.id_real);
        
        let matchesBusqueda = true;
        
        if (numeroFactura !== "") {
            const facturaBuscada = normalizarTexto(`f-${anioSeleccionado}-${numeroFactura}`);
            matchesBusqueda = card.dataset.factura === facturaBuscada;
        }
        
        if (!matchesBusqueda) return false;

        if (estadoFiltro === "HistorialAnulados") return esAnulado && estaVerificado;
        if (esAnulado && estaVerificado) return false;

        if (estadoFiltro === "Terminados") {
            return card.dataset.estado === "Entregado" && card.dataset.pagado === "true";
        } else if (estadoFiltro !== "Todos") {
            return card.dataset.estado === estadoFiltro;
        }
        return true;
    });
    renderizarPaginacion(pedidosFiltrados);
}

function inicializarSelectAnios() {
    const selectAnio = document.getElementById("selectAnio");
    const anioActual = new Date().getFullYear();
    
    for (let i = anioActual; i >= anioActual - 5; i--) {
        const option = document.createElement("option");
        option.value = i;
        option.textContent = i;
        selectAnio.appendChild(option);
    }
}

document.getElementById("eliminarSeleccionados").onclick = () => {
    const seleccionados = document.querySelectorAll(".pedido-card.seleccion");
    if (seleccionados.length === 0) {
        showMessage("No hay pedidos seleccionados", true);
        return;
    }
    
    showConfirmToast(`¿Desea eliminar ${seleccionados.length} pedidos definitivamente?`, async () => {
        for (const card of seleccionados) {
            const idPedido = card.id.replace("pedido-", "");
            await fetch(`/eliminar_pedido/${idPedido}`, { method: "DELETE" });
        }
        await cargarPedidos();
        showMessage("Pedidos eliminados con éxito");
    });
};

document.getElementById("inputNumeroFactura").addEventListener("input", () => {
    paginaActual = 1;
    aplicarFiltros();
});
document.getElementById("selectAnio").addEventListener("change", () => {
    paginaActual = 1;
    aplicarFiltros();
});
document.getElementById("filtroEstado").addEventListener("change", () => {
    paginaActual = 1;
    aplicarFiltros();
});

inicializarSelectAnios();
setInterval(cargarPedidos, 20000);
cargarPedidos();