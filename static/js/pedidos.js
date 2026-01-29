const toastContainer = document.getElementById('toastContainer');
const alertaCancelado = document.getElementById('alertaCancelado');
const itemsPorPagina = 5; 
let pedidosGlobal = [];
let pedidosDatosRaw = [];
let pedidosFiltrados = [];
let ultimosIdsCancelados = [];
let pedidosCanceladosVerificados = JSON.parse(localStorage.getItem("pedidosCanceladosVerificados") || "[]");
let estadosPagoGuardados = JSON.parse(localStorage.getItem("estadosPagoItems") || "{}");
let pedidosFijados = JSON.parse(localStorage.getItem("pedidosFijados") || "[]");
let paginaActual = 1;
let contadorFacturasPorAnio = JSON.parse(localStorage.getItem("contadorFacturasPorAnio") || "{}");
let ultimoIdPedidoNotificado = parseInt(localStorage.getItem("ultimoIdPedidoNotificado") || "0");

const sonidoNuevoPedido = new Audio('https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3');
sonidoNuevoPedido.volume = 0.7;

async function verificarAccesoAdmin() {
    try {
        const res = await fetch("/gestionar_productos");
        
        if (res.status === 401 || res.status === 403) {
            document.documentElement.innerHTML = `
                <head>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
                    <style>
                        body { background: #000; color: white; height: 100vh; display: flex; align-items: center; justify-content: center; font-family: sans-serif; overflow: hidden; }
                        .lock-box { text-align: center; border: 1px solid #333; padding: 3rem; border-radius: 20px; background: #0a0a0a; }
                        .shield-icon { font-size: 5rem; color: #ff4757; animation: pulse 2s infinite; }
                        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.7; } 100% { transform: scale(1); opacity: 1; } }
                    </style>
                </head>
                <body>
                    <div class="lock-box shadow-lg">
                        <i class="bi bi-shield-slash-fill shield-icon"></i>
                        <h1 class="fw-bold mt-3">MÓDULO PROTEGIDO</h1>
                        <p class="text-secondary">Se requiere nivel de acceso administrativo para esta sección.</p>
                        <div class="spinner-border text-danger my-3" role="status"></div>
                        <br>
                        <button onclick="window.location.href='/'" class="btn btn-outline-danger mt-2 px-5">SALIR</button>
                    </div>
                </body>
            `;
            setTimeout(() => { window.location.href = "/"; }, 4000);
            return false;
        }
        return true;
    } catch (e) {
        return false;
    }
}

function showMessage(msg, isError = false) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        container.style.cssText = "position: fixed; top: 20px; right: 20px; z-index: 9999;";
        document.body.appendChild(container);
    }

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

function escucharEventosTiempoReal() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'nuevoPedidoDetectado') {
            cargarPedidos();
        }
        if (e.key === 'pedidoAnuladoRecientemente') {
            const data = JSON.parse(e.newValue);
            notificarAnulacionCritica(data);
            cargarPedidos();
        }
    });
}

async function iniciarModuloPedidos() {
    const tieneAcceso = await verificarAccesoAdmin();
    if (!tieneAcceso) return;

    inicializarSelectAnios();
    await cargarPedidos();
    escucharEventosTiempoReal();
    
    setInterval(() => cargarPedidos(true), 15000);

    const btnPDF = document.getElementById("btnGenerarPDF");
    if (btnPDF) {
        btnPDF.addEventListener("click", generarReporteConfigurado);
    }

    const inputsFiltro = [
        "inputBusquedaNombre", 
        "inputBusquedaCedula", 
        "inputNumeroFactura", 
        "selectAnio", 
        "filtroEstado"
    ];

    inputsFiltro.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const evento = (id.includes("select") || id.includes("filtro")) ? "change" : "input";
            el.addEventListener(evento, () => {
                paginaActual = 1;
                aplicarFiltros();
            });
        }
    });
}

iniciarModuloPedidos();

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
    if (!texto) return "";
    return texto.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '');
}

function renderizarPaginacion(lista) {
    const totalPaginas = Math.ceil(lista.length / itemsPorPagina) || 1;
    const pagUl = document.getElementById("pagination");
    if (!pagUl) return;
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
    if (!cont) return;
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
    if (!titulo) return;
    const filtro = document.getElementById("filtroEstado").value;
    const titulos = {
        "Todos": "MOSTRANDO TODOS LOS PEDIDOS",
        "FiltroPagoPendiente": "Pedidos Activos (PAGOS O ENTREGAS PENDIENTES)",
        "Entregado": "Pedidos Finalizados (PAGADOS Y ENTREGADOS)",
        "Cancelado": "Pedidos Anulados"
    };
    titulo.textContent = titulos[filtro] || "Pedidos";
}

async function cargarPedidos(isAutoRefresh = false) {
    const algunInputFocado = document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT';
    if (isAutoRefresh && algunInputFocado) return;

    try {
        const res = await fetch("/obtener_pedidos");
        const pedidos = await res.json();
        if (!Array.isArray(pedidos)) return;

        const nuevosCancelados = pedidos.filter(p => p.estado === 'Cancelado').map(p => String(p.id_pedido));
        
        if (isAutoRefresh && typeof ultimosIdsCancelados !== 'undefined' && ultimosIdsCancelados.length > 0) {
            const detectados = nuevosCancelados.filter(id => !ultimosIdsCancelados.includes(id));
            if (detectados.length > 0) {
                const idNotificar = detectados[0];
                const pedidoData = pedidos.find(p => String(p.id_pedido) === idNotificar);
                const nombreCliente = `${pedidoData?.usuarios?.nombre || "Un"} ${pedidoData?.usuarios?.apellido || "cliente"}`;
                showMessage(`⚠️ EL CLIENTE ${nombreCliente.toUpperCase()} HA ANULADO EL PEDIDO #${idNotificar}`);
            }
        }
        ultimosIdsCancelados = nuevosCancelados;

        pedidosDatosRaw = pedidos;
        
        const nuevasCards = pedidos.map(pedido => {
            const idPedidoStr = String(pedido.id_pedido);
            const facturaFormateada = generarNumeroFactura(pedido.id_pedido, pedido.fecha_pedido);
            const esFijado = pedidosFijados.includes(idPedidoStr);
            const user = pedido.usuarios || {};
            
            const cardExistente = document.getElementById(`pedido-${pedido.id_pedido}`);
            const estabaAbierta = cardExistente ? !cardExistente.classList.contains('card-collapsed') : false;

            const card = document.createElement("div");
            let totalPendientePedido = 0;

            const itemsRowsHTML = (pedido.pedido_detalle || []).map((item, idx) => {
                const itemId = `${pedido.id_pedido}-${idx}`;
                let pagadoItem = estadosPagoGuardados[itemId] !== undefined ? estadosPagoGuardados[itemId] : (item.pagado !== undefined ? item.pagado : pedido.pagado);
                const subtotal = Number(item.subtotal || 0);
                if (!pagadoItem) totalPendientePedido += subtotal;

                return `<tr>
                    <td class="text-start">${item.gestion_productos?.nombre || item.nombre_producto || 'Producto'}</td>
                    <td>${item.cantidad}</td>
                    <td>${subtotal.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</td>
                    <td><i class="bi ${pagadoItem ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} fs-4 toggle-pago-item" style="cursor:pointer" data-item-id="${itemId}" data-pagado="${pagadoItem}"></i></td>
                </tr>`;
            }).join("");

            const todosPagos = (pedido.pedido_detalle || []).every((_, idx) => {
                const itemId = `${pedido.id_pedido}-${idx}`;
                return estadosPagoGuardados[itemId] !== undefined ? estadosPagoGuardados[itemId] : (pedido.pedido_detalle[idx].pagado !== undefined ? pedido.pedido_detalle[idx].pagado : pedido.pagado);
            });

            const esTerminado = pedido.estado === 'Entregado' && todosPagos;
            const esAnulado = pedido.estado === 'Cancelado';
            const bloqueado = esTerminado || esAnulado;
            let estadoClase = esAnulado ? "pedido-anulado border-danger" : (esTerminado ? "pedido-finalizado" : "pedido-activo");

            card.className = `pedido-card col-12 mb-3 p-1 shadow-sm ${estadoClase} ${esFijado ? 'fijado border-primary' : ''} ${estabaAbierta ? '' : 'card-collapsed'}`;
            card.id = `pedido-${pedido.id_pedido}`;
            card.dataset.id_real = idPedidoStr;
            card.dataset.factura = normalizarTexto(facturaFormateada);
            card.dataset.estado = pedido.estado;
            card.dataset.todosPagos = todosPagos.toString();
            card.dataset.fijado = esFijado.toString();

            const fechaStr = pedido.fecha_pedido ? new Date(pedido.fecha_pedido).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '---';

            card.innerHTML = `
                <div class="card border-0 bg-transparent">
                    <div class="card-header d-flex justify-content-between align-items-center bg-transparent border-0 py-2">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi ${esFijado ? 'bi-pin-angle-fill text-primary' : 'bi-pin-angle'} fs-5 btn-fijar" style="cursor:pointer"></i>
                            <img src="${user.imagen_url || '/static/uploads/default.png'}" class="rounded-circle border" style="width:38px;height:38px;object-fit:cover;">
                            <div class="lh-1">
                                <strong class="d-block" style="font-size:0.9rem">${facturaFormateada}</strong>
                                <small class="status-info ${esAnulado ? 'text-danger fw-bold' : 'text-muted'}" style="font-size:0.75rem">${pedido.estado} | ${fechaStr}</small>
                            </div>
                        </div>
                        <div class="d-flex gap-2">
                            <i class="bi bi-chevron-down icono fs-4 toggle-detalle"></i>
                            <i class="bi bi-trash icono text-danger fs-4 btn-eliminar-individual" style="cursor:pointer"></i>
                        </div>
                    </div>
                    <div class="card-body pt-0">
                        <div class="mb-2 border-top pt-2" style="font-size:0.85rem">
                            <div class="row">
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Cliente:</strong> ${user.nombre || ''} ${user.apellido || ''}</p>
                                    <p class="mb-1"><strong>Cédula:</strong> ${user.cedula || 'N/A'}</p>
                                    <p class="mb-1"><strong>Teléfono:</strong> ${user.telefono || 'N/A'}</p>
                                </div>
                                <div class="col-md-6">
                                    <p class="mb-1"><strong>Dirección:</strong> ${pedido.direccion_envio || user.direccion || 'N/A'}</p>
                                    <p class="mb-1"><strong>Método Pago:</strong> <span class="badge bg-info text-dark">${pedido.metodo_pago || 'No especificado'}</span></p>
                                </div>
                            </div>
                        </div>
                        <div class="table-responsive-container">
                            <table class="table table-sm text-center mb-0">
                                <thead><tr><th class="text-start">Productos</th><th>Cant.</th><th>Subtotal</th><th>Pago?</th></tr></thead>
                                <tbody>${itemsRowsHTML}</tbody>
                                <tfoot class="table-light">
                                    <tr>
                                        <td colspan="2" class="text-end fw-bold">Total Pendiente:</td>
                                        <td colspan="2" class="text-start fw-bold text-danger ps-3">
                                            ${totalPendientePedido.toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div class="d-flex gap-2 mt-3">
                            <select class="form-select form-select-sm estado-select" ${bloqueado ? 'disabled' : ''}>
                                <option value="Pendiente" ${pedido.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="Enviado" ${pedido.estado === 'Enviado' ? 'selected' : ''}>Enviado</option>
                                <option value="Entregado" ${pedido.estado === 'Entregado' ? 'selected' : ''}>Finalizado</option>
                                <option value="Cancelado" ${pedido.estado === 'Cancelado' ? 'selected' : ''}>Anulado</option>
                            </select>
                            <button class="btn btn-primary btn-sm actualizar-btn px-3" ${bloqueado ? 'disabled' : ''}>Actualizar</button>
                        </div>
                    </div>
                </div>`;

            card.querySelectorAll(".toggle-pago-item").forEach(icon => {
                icon.onclick = async () => {
                    if (bloqueado) return;
                    const itemId = icon.dataset.itemId;
                    const val = icon.dataset.pagado === 'false';
                    estadosPagoGuardados[itemId] = val;
                    localStorage.setItem("estadosPagoItems", JSON.stringify(estadosPagoGuardados));
                    
                    const res = await fetch(`/actualizar_pago/${pedido.id_pedido}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ pagado: val })
                    });

                    if (res.ok) { 
                        showMessage("Cobro actualizado");
                        await cargarPedidos(); 
                    }
                };
            });

            card.querySelector(".btn-fijar").onclick = () => {
                pedidosFijados = pedidosFijados.includes(idPedidoStr) ? pedidosFijados.filter(id => id !== idPedidoStr) : [...pedidosFijados, idPedidoStr];
                localStorage.setItem("pedidosFijados", JSON.stringify(pedidosFijados));
                aplicarFiltros();
            };

            card.querySelector(".btn-eliminar-individual").onclick = async () => {
                const r = await fetch("/eliminar_pedidos", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [idPedidoStr] }) });
                if (r.ok) { showMessage("Pedido eliminado"); await cargarPedidos(); }
            };

            card.querySelector(".toggle-detalle").onclick = (e) => {
                e.stopPropagation();
                card.classList.toggle("card-collapsed");
            };

            card.querySelector(".actualizar-btn").onclick = async () => {
                const nuevo = card.querySelector(".estado-select").value;
                const r = await fetch(`/actualizar_estado/${pedido.id_pedido}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: nuevo }) });
                if (r.ok) { 
                    showMessage(`Estado: ${nuevo}`); 
                    await cargarPedidos(); 
                }
            };

            return card;
        });

        pedidosGlobal = nuevasCards;
        aplicarFiltros();

    } catch (e) { console.error(e); }
}

function aplicarFiltros() {
    const anio = document.getElementById("selectAnio")?.value;
    const numFact = document.getElementById("inputNumeroFactura")?.value.trim();
    const filtroEstado = document.getElementById("filtroEstado")?.value;
    const busquedaNombre = normalizarTexto(document.getElementById("inputBusquedaNombre")?.value);
    const busquedaCedula = normalizarTexto(document.getElementById("inputBusquedaCedula")?.value);
    
    let filtrados = pedidosGlobal.filter(card => {
        const idReal = card.dataset.id_real;
        const pedidoData = pedidosDatosRaw.find(p => String(p.id_pedido) === idReal);
        const user = pedidoData?.usuarios || {};
        
        const nombreNorm = normalizarTexto(`${user.nombre || ''}${user.apellido || ''}`);
        const cedulaNorm = normalizarTexto(user.cedula);
        const est = card.dataset.estado;
        const pagos = card.dataset.todosPagos === "true";
        const verif = pedidosCanceladosVerificados.includes(idReal);

        if (busquedaNombre && !nombreNorm.includes(busquedaNombre)) return false;
        if (busquedaCedula && !cedulaNorm.includes(busquedaCedula)) return false;

        let matchFactura = numFact === "" || card.dataset.factura === normalizarTexto(`f-${anio}-${numFact}`);
        if (!matchFactura) return false;

        if (filtroEstado === "FiltroPagoPendiente") return !pagos && est !== "Cancelado";
        if (filtroEstado === "Pendiente") return est === "Pendiente";
        if (filtroEstado === "Entregado") return est === "Entregado" && pagos;
        if (filtroEstado === "Cancelado") return est === "Cancelado";
        if (est === "Cancelado" && verif && filtroEstado === "Todos") return false;

        return true;
    });

    const grupos = {
        activos: [],
        finalizados: [],
        anulados: []
    };

    filtrados.forEach(card => {
        const est = card.dataset.estado;
        const pagos = card.dataset.todosPagos === "true";

        if (est === "Cancelado") {
            grupos.anulados.push(card);
        } else if (est === "Entregado" && pagos) {
            grupos.finalizados.push(card);
        } else {
            grupos.activos.push(card);
        }
    });

    const ordenarGrupo = (arr) => arr.sort((a, b) => {
        const aF = a.dataset.fijado === "true" ? 1 : 0;
        const bF = b.dataset.fijado === "true" ? 1 : 0;
        if (aF !== bF) return bF - aF;
        return parseInt(b.dataset.id_real) - parseInt(a.dataset.id_real);
    });

    const finalListaConSeparadores = [];
    
    if (grupos.activos.length > 0) {
        finalListaConSeparadores.push(crearSeparador("PEDIDOS ACTIVOS / PENDIENTES", "bg-primary"));
        finalListaConSeparadores.push(...ordenarGrupo(grupos.activos));
    }
    
    if (grupos.finalizados.length > 0) {
        finalListaConSeparadores.push(crearSeparador("TRANSACCIONES FINALIZADAS", "bg-success"));
        finalListaConSeparadores.push(...ordenarGrupo(grupos.finalizados));
    }
    
    if (grupos.anulados.length > 0) {
        finalListaConSeparadores.push(crearSeparador("PEDIDOS ANULADOS", "bg-danger"));
        finalListaConSeparadores.push(...ordenarGrupo(grupos.anulados));
    }

    pedidosFiltrados = finalListaConSeparadores;
    renderizarPaginacion(pedidosFiltrados);
}

function crearSeparador(texto, claseColor) {
    const div = document.createElement("div");
    div.className = "col-12 my-3";
    div.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-grow-1 border-top border-2"></div>
            <span class="badge ${claseColor} mx-3 py-2 px-4 rounded-pill shadow-sm" style="font-size: 0.85rem; letter-spacing: 1px;">
                <i class="bi bi-funnel-fill me-2"></i>${texto}
            </span>
            <div class="flex-grow-1 border-top border-2"></div>
        </div>
    `;
    div.dataset.esSeparador = "true";
    return div;
}

function inicializarSelectAnios() {
    const s = document.getElementById("selectAnio");
    const rs = document.getElementById("repoAnio");
    if (!s || !rs) return;
    const a = new Date().getFullYear();
    for (let i = a; i >= a - 5; i--) {
        const o = document.createElement("option"); o.value = i; o.textContent = i;
        const o2 = o.cloneNode(true);
        s.appendChild(o);
        rs.appendChild(o2);
    }
}

document.getElementById("btnGenerarPDF")?.addEventListener("click", generarReporteConfigurado);

async function generarReporteConfigurado() {
    const { jsPDF } = window.jspdf;
    const repoEstado = document.getElementById("repoEstado").value;
    const repoAnio = document.getElementById("repoAnio").value;
    const repoMes = document.getElementById("repoMes").value;
    const admin = document.getElementById("adminName").value;
    
    let listaParaPdf = pedidosDatosRaw.filter(p => {
        const fechaP = new Date(p.fecha_pedido);
        const anioP = fechaP.getFullYear().toString();
        const mesP = fechaP.getMonth().toString();

        if (anioP !== repoAnio) return false;
        if (repoMes !== "Todos" && mesP !== repoMes) return false;
        if (repoEstado !== "Todos" && p.estado !== repoEstado) return false;
        return true;
    });

    if (listaParaPdf.length === 0) return showMessage("No hay pedidos con esos criterios", true);

    listaParaPdf.sort((a, b) => new Date(b.fecha_pedido) - new Date(a.fecha_pedido));

    const doc = new jsPDF();
    const logoUrl = '/static/uploads/logo.png';
    try {
        const img = new Image(); img.src = logoUrl;
        await new Promise(r => img.onload = r);
        const canv = document.createElement('canvas'); canv.width = img.width; canv.height = img.height;
        canv.getContext('2d').drawImage(img, 0, 0);
        doc.addImage(canv.toDataURL('image/png'), 'PNG', 15, 10, 20, 20);
    } catch(e){}

    const nombreMeses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const subtituloMes = repoMes === "Todos" ? "Anual" : nombreMeses[parseInt(repoMes)];

    doc.setFontSize(18); doc.text("Reporte de Ventas D'Antojitos ©", 40, 20);
    doc.setFontSize(10); doc.text(`Periodo: ${subtituloMes} ${repoAnio} | Estado: ${repoEstado.toUpperCase()}`, 40, 26);
    doc.text(`Fecha Emisión: ${new Date().toLocaleString()}`, 140, 20);

    let totalAcumulado = 0;
    const stats = { Pendiente: 0, Entregado: 0, Cancelado: 0 };

    const body = listaParaPdf.map(p => {
        const sub = (p.pedido_detalle || []).reduce((a, b) => a + b.subtotal, 0);
        totalAcumulado += sub;
        if(stats[p.estado] !== undefined) stats[p.estado]++;
        return [
            generarNumeroFactura(p.id_pedido, p.fecha_pedido),
            new Date(p.fecha_pedido).toLocaleDateString(),
            `${p.usuarios?.nombre || ''} ${p.usuarios?.apellido || ''}`,
            p.estado.toUpperCase(),
            sub.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
        ];
    });

    body.push([
        { content: 'TOTAL ACUMULADO', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: totalAcumulado.toLocaleString('es-CO', { style: 'currency', currency: 'COP' }), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
    ]);

    doc.autoTable({
        startY: 35,
        head: [['Factura', 'Fecha', 'Cliente', 'Estado', 'Subtotal']],
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] }
    });

    let finalY = doc.lastAutoTable.finalY + 15;
    if (finalY > 220) { doc.addPage(); finalY = 20; }
    
    dibujarGraficoEstadistico(doc, stats, finalY);

    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generado por Administrador: ${admin}`, 15, 285);
    doc.text(`D'Antojitos © - Página ${pageCount}`, 170, 285);

    const fechaActualStr = new Date().toISOString().split('T')[0];
    doc.save(`reporte_dantojitos_${fechaActualStr}.pdf`);
    
    const modalElement = document.getElementById('modalConfigReporte');
    const modalInstance = bootstrap.Modal.getInstance(modalElement);
    if (modalInstance) modalInstance.hide();
    
    showMessage("Reporte generado con éxito");
}

function dibujarGraficoEstadistico(doc, stats, y) {
    const total = stats.Pendiente + stats.Entregado + stats.Cancelado;
    const centerX = 105;
    const centerY = y + 40;
    const radius = 25;

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Resumen Estadístico de Pedidos", 105, y, { align: "center" });

    if (total === 0) {
        doc.setFontSize(10);
        doc.text("No hay datos para representar", 105, y + 20, { align: "center" });
        return;
    }

    const colors = { 
        Pendiente: [255, 193, 7], 
        Entregado: [40, 167, 69], 
        Cancelado: [220, 53, 69] 
    };

    let currentAngle = 0;

    Object.entries(stats).forEach(([label, count]) => {
        if (count > 0) {
            const percent = count / total;
            const sliceAngle = percent * 2 * Math.PI;
            
            doc.setFillColor(...colors[label]);
            
            let points = [{ x: centerX, y: centerY }];
            const steps = 40; 
            for (let i = 0; i <= steps; i++) {
                const angle = currentAngle + (i / steps) * sliceAngle;
                points.push({ 
                    x: centerX + radius * Math.cos(angle), 
                    y: centerY + radius * Math.sin(angle) 
                });
            }
            
            const lines = points.map((p, idx) => {
                if (idx === 0) return [p.x, p.y];
                return [p.x - points[idx-1].x, p.y - points[idx-1].y];
            });

            doc.lines(lines.slice(1), points[0].x, points[0].y, [1, 1], 'F');

            const middleAngle = currentAngle + (sliceAngle / 2);
            const textX = centerX + (radius + 8) * Math.cos(middleAngle);
            const textY = centerY + (radius + 8) * Math.sin(middleAngle);
            
            doc.setFontSize(8);
            doc.setTextColor(60);
            const textAlign = textX > centerX ? "left" : "right";
            doc.text(`${(percent * 100).toFixed(1)}%`, textX, textY, { align: textAlign });

            currentAngle += sliceAngle;
        }
    });

    let legendY = centerY + radius + 15;
    let legendX = 65;
    
    Object.entries(colors).forEach(([label, color]) => {
        doc.setFillColor(...color);
        doc.rect(legendX, legendY, 3, 3, 'F');
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.text(`${label}: ${stats[label]}`, legendX + 5, legendY + 2.5);
        legendX += 30;
    });
}

document.addEventListener('change', async (e) => {
    if (e.target.classList.contains('check-pago')) {
        const idPedido = e.target.dataset.id;
        const estaPagado = e.target.checked;

        try {
            const response = await fetch(`/actualizar_pago/${idPedido}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pagado: estaPagado })
            });

            const result = await response.json();

            if (!response.ok) {
                e.target.checked = !estaPagado;
                mostrarNotificacionInterna(result.error, "error");
            } else {
                mostrarNotificacionInterna("Pago actualizado", "success");
            }
        } catch (error) {
            e.target.checked = !estaPagado;
            console.error("Error al actualizar pago:", error);
        }
    }
});

const inputsFiltro = ["inputBusquedaNombre", "inputBusquedaCedula", "inputNumeroFactura", "selectAnio", "filtroEstado"];
inputsFiltro.forEach(id => {
    document.getElementById(id)?.addEventListener(id.includes("select") || id.includes("filtro") ? "change" : "input", () => {
        paginaActual = 1;
        aplicarFiltros();
    });
});

document.addEventListener("DOMContentLoaded", async () => {
    const tieneAcceso = await verificarAccesoAdmin();
    
    if (!tieneAcceso) return;

    const carrusel = document.getElementById("carruselContainer");
    if (carrusel) {
        cargarPublicidadActiva();
        cargarAlertasActivas();
        initDrag("carruselContainer");
        initDrag("seccionesContainer");
        initDrag("cintaContainer");
        
        document.getElementById("btnGuardarMarketing")?.addEventListener("click", guardarMarketing);
        document.getElementById("btnPublicarNotificacion")?.addEventListener("click", crearNotificacion);

        const inputNotificacion = document.getElementById("archivoNotificacion");
        if (inputNotificacion) {
            inputNotificacion.onchange = function() {
                const file = this.files[0];
                if (validarArchivo(file)) {
                    const reader = new FileReader();
                    reader.onload = e => {
                        const preview = document.getElementById("previewNotificacion");
                        const img = document.getElementById("previewNotificacionImg");
                        if (img) img.src = e.target.result;
                        if (preview) preview.style.display = "block";
                    };
                    reader.readAsDataURL(file);
                }
            };
        }
    }
});

inicializarSelectAnios();
cargarPedidos();
escucharEventosTiempoReal();
setInterval(() => cargarPedidos(true), 15000);

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-pedidos.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}