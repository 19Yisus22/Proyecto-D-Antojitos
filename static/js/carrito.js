let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 5;
let productosCarrito = [];
let facturasLocalesCache = []; 
let catalogoLocalCache = [];
let metodosPagoCache = [];

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const t = document.createElement('div');
    t.className = 'custom-toast bg-dark text-white p-3 shadow-lg mb-2';
    t.style.cssText = `
        border-left: 4px solid #ffc107;
        min-width: 300px;
        border-radius: 8px;
        pointer-events: auto !important;
        opacity: 1;
        display: block;
    `;

    t.innerHTML = `
        <div class="mb-3">
            <i class="bi bi-exclamation-triangle text-warning me-2"></i>
            <strong>${msg}</strong>
        </div>
        <div class="d-flex gap-2 justify-content-end">
            <button class="btn btn-sm btn-outline-light border-0 btn-cancelar-confirm">Cancelar</button>
            <button class="btn btn-sm btn-warning fw-bold px-3 btn-aceptar-confirm">Confirmar</button>
        </div>
    `;

    container.appendChild(t);

    t.querySelector('.btn-cancelar-confirm').onclick = (e) => {
        e.stopPropagation();
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    };

    t.querySelector('.btn-aceptar-confirm').onclick = (e) => {
        e.stopPropagation();
        callback();
        t.remove();
    };
}

function showMessage(msg, isError = false) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'custom-toast bg-dark text-white p-3 shadow-lg mb-2';
    toast.style.cssText = `
        border-left: 4px solid ${isError ? '#dc3545' : '#198754'};
        min-width: 300px;
        border-radius: 8px;
        pointer-events: auto !important;
    `;

    toast.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div class="d-flex align-items-center">
                <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
                <span>${msg}</span>
            </div>
            <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>
    `;

    container.appendChild(toast);

    const remove = () => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = (e) => {
        e.stopPropagation();
        remove();
    };

    setTimeout(remove, 3500);
}

function playNotificationSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') return;
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
    } catch (e) {}
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
    setTimeout(remove, 5000);
}

async function cargarMetodosPago() {
    try {
        const res = await fetch("/obtener_metodos_pago");
        if (res.ok) {
            const data = await res.json();
            metodosPagoCache = data.metodos || [];
        }
    } catch (e) {
        console.error("Error cargando métodos de pago:", e);
    }
}

function abrirModalPago(facturaNum, total) {
    const modalElement = document.getElementById('modalPago');
    const modalBody = document.getElementById("modalPagoBody");
    if (!modalElement || !modalBody) return;

    if (!metodosPagoCache || metodosPagoCache.length === 0) {
        modalBody.innerHTML = `
            <div class="text-center p-5">
                <i class="bi bi-wallet2 fs-1 text-muted mb-3 d-block"></i>
                <h5 class="text-secondary">Sin métodos registrados</h5>
                <p class="small text-muted">No hay cuentas de pago disponibles en este momento.</p>
            </div>`;
    } else {
        modalBody.innerHTML = `
            <div class="text-center mb-4 border-bottom pb-3">
                <p class="text-muted mb-1 small text-uppercase fw-bold">Referencia de Pago</p>
                <h4 class="fw-bold text-dark mb-1">${facturaNum}</h4>
                <div class="fs-3 fw-bold text-primary">${total}</div>
            </div>
            <div class="row g-4 justify-content-center">
                ${metodosPagoCache.map(m => `
                    <div class="col-12 col-md-6">
                        <div class="card h-100 border-0 shadow-sm rounded-4 overflow-hidden">
                            <div class="card-header bg-dark text-white text-center py-2 border-0">
                                <span class="fw-bold small text-uppercase">${m.entidad} - ${m.tipo_cuenta}</span>
                            </div>
                            <div class="card-body p-3 text-center bg-white">
                                <div class="mb-3">
                                    <img src="${m.qr_url || '/static/uploads/no-qr.png'}" 
                                         class="img-fluid rounded-3 border p-2 bg-light shadow-sm" 
                                         style="max-height: 200px; width: 100%; object-fit: contain;"
                                         onerror="this.src='/static/uploads/no-qr.png'">
                                </div>
                                <div class="bg-light rounded-3 p-3 border">
                                    <p class="text-muted small mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">Titular de la cuenta</p>
                                    <p class="mb-2 fw-semibold text-dark">${m.titular}</p>
                                    
                                    <hr class="my-2 opacity-25">
                                    
                                    <p class="text-muted small mb-1 text-uppercase fw-bold" style="font-size: 0.65rem;">Número / Celular</p>
                                    <div class="d-flex align-items-center justify-content-center gap-2">
                                        <span class="fs-5 fw-bold text-primary text-break">${m.numero}</span>
                                        <button class="btn btn-primary btn-sm rounded-circle d-flex align-items-center justify-content-center" 
                                                style="width: 32px; height: 32px;"
                                                onclick="navigator.clipboard.writeText('${m.numero}').then(() => showMessage('Número copiado al portapapeles'))"
                                                title="Copiar número">
                                            <i class="bi bi-clipboard"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <div class="mt-4 p-3 bg-primary bg-opacity-10 border border-primary border-dashed rounded-3 text-center">
                <p class="small text-primary mb-0 fw-medium">
                    <i class="bi bi-info-circle-fill me-2"></i>Realiza la transferencia y adjunta el comprobante vía WhatsApp o al correo <strong>d.antojitos1958@gmail.com</strong>
                </p>
            </div>
        `;
    }
    
    const bootstrapModal = bootstrap.Modal.getOrCreateInstance(modalElement);
    bootstrapModal.show();
}

async function verificarCambiosCatalogoYCarrito() {
    try {
        const resCatalogo = await fetch("/obtener_catalogo");
        if (!resCatalogo.ok) return;
        const dataCatalogo = await resCatalogo.json();
        const catalogo = dataCatalogo.productos || [];

        const resCarrito = await fetch("/obtener_carrito");
        if (!resCarrito.ok) return;
        const miCarrito = await resCarrito.json();
        const productosEnCarrito = miCarrito.productos || [];

        const cartHash = JSON.stringify(productosEnCarrito.map(p => ({ id: p.id_producto, cant: p.cantidad })));
        const lastHash = localStorage.getItem('last_cart_hash');

        if (productosEnCarrito.length > 0) {
            productosEnCarrito.forEach(itemCarrito => {
                const productoReal = catalogo.find(p => p.id_producto == itemCarrito.id_producto);
                
                if (productoReal) {
                    const itemAnterior = productosCarrito.find(p => p.id_producto == itemCarrito.id_producto);
                    
                    if (itemAnterior) {
                        if (itemAnterior.stock_disponible > 0 && productoReal.stock <= 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Agotado",
                                `${itemCarrito.nombre_producto} ya no está disponible en el catálogo`,
                                true
                            );
                            cargarCarrito();
                        } else if (itemAnterior.stock_disponible <= 0 && productoReal.stock > 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Disponible",
                                `${itemCarrito.nombre_producto} vuelve a tener existencias`
                            );
                            cargarCarrito();
                        } else if (itemAnterior.stock_disponible > productoReal.stock && productoReal.stock > 0 && itemCarrito.cantidad > productoReal.stock) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Stock Insuficiente",
                                `${itemCarrito.nombre_producto} redujo su stock a ${productoReal.stock} unidades`,
                                true
                            );
                            cargarCarrito();
                        }
                    }

                    const index = productosCarrito.findIndex(p => p.id_producto == itemCarrito.id_producto);
                    if (index !== -1) {
                        productosCarrito[index].stock_disponible = productoReal.stock;
                    } else {
                        productosCarrito.push({
                            id_producto: itemCarrito.id_producto,
                            stock_disponible: productoReal.stock
                        });
                    }
                }
            });

            if (lastHash && lastHash !== cartHash) {
                cargarCarrito();
            }
            localStorage.setItem('last_cart_hash', cartHash);

            productosCarrito = productosCarrito.filter(p => 
                productosEnCarrito.some(c => c.id_producto == p.id_producto)
            );
        } else if (lastHash && lastHash !== "[]") {
            localStorage.setItem('last_cart_hash', "[]");
            cargarCarrito();
        }
        
        catalogoLocalCache = catalogo;
    } catch (e) {
        console.error("Error en verificación de catálogo:", e);
    }
}

async function descargarPDF(f) {
    const { jsPDF } = window.jspdf || window.jsPDF;
    if (!jsPDF) {
        showMessage("Error al cargar generador de PDF", true);
        return;
    }
    
    const doc = new jsPDF();
    const logoUrl = '/static/uploads/logo.png';

    try {
        const img = new Image();
        img.src = logoUrl;
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        doc.addImage(canvas.toDataURL('image/png'), 'PNG', 15, 12, 22, 22);
    } catch (e) { console.warn("Logo no cargado"); }

    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text("D'Antojitos ©", 42, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Factura N°: ${f.numero_factura}`, 145, 20);
    doc.text(`Fecha: ${new Date(f.fecha_emision).toLocaleString()}`, 145, 25);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(f.estado === 'Anulada' ? 220 : 40, f.estado === 'Anulada' ? 53 : 167, f.estado === 'Anulada' ? 69 : 69);
    doc.text(`ESTADO: ${f.estado.toUpperCase()}`, 145, 30);
    doc.setFont("helvetica", "normal");

    const tableData = (f.productos || []).map(p => [
        p.nombre_producto,
        `x${p.cantidad}`,
        Number(p.subtotal).toLocaleString('es-CO', { style: 'currency', currency: 'COP' })
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Producto', 'Cantidad', 'Subtotal']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [33, 37, 41] }
    });

    const finalY = doc.lastAutoTable.finalY;
    const total = (f.productos || []).reduce((acc, curr) => acc + Number(curr.subtotal), 0);
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text(`TOTAL: ${total.toLocaleString('es-CO', { style: 'currency', currency: 'COP' })}`, 195, finalY + 12, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100);
    const mensaje1 = "Espere a que se procese el pedido en el sistema.";
    const mensaje2 = "¡Gracias por la compra!";
    const textWidth1 = doc.getStringUnitWidth(mensaje1) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    const textWidth2 = doc.getStringUnitWidth(mensaje2) * doc.internal.getFontSize() / doc.internal.scaleFactor;
    doc.text(mensaje1, (210 - textWidth1) / 2, finalY + 30);
    doc.setFont("helvetica", "bolditalic");
    doc.text(mensaje2, (210 - textWidth2) / 2, finalY + 38);

    doc.save(`Factura_${f.numero_factura}.pdf`);
    showMessage("Descarga finalizada PDF");
}

async function cargarCarrito() {
    const container = document.getElementById("carritoContainer");
    const btn = document.getElementById("btnFinalizarCompra");
    
    try {
        const res = await fetch("/obtener_carrito");
        if (!res.ok) return;
        const data = await res.json();
        
        let cantidadTotalItems = 0;
        if (data.productos && data.productos.length > 0) {
            data.productos.forEach(item => {
                cantidadTotalItems += item.cantidad;
            });
        }

        actualizarContadorBadge(cantidadTotalItems);

        if (!container) return;
        container.innerHTML = "";

        if (!data.productos || data.productos.length === 0) {
            container.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-cart-x fs-1"></i><p class="mt-2">El carrito está vacío</p></div>';
            if (btn) {
                btn.style.display = "none";
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Pedido';
            }
            return;
        }

        if (btn) {
            btn.style.display = "inline-block";
            if (!btn.innerHTML.includes("spinner-border")) {
                btn.disabled = false;
                btn.innerHTML = '<i class="bi bi-send me-2"></i> Enviar Pedido';
            }
        }

        let totalGeneral = 0;
        const tabla = document.createElement("table");
        tabla.className = "custom-table-carrito align-middle mb-0";
        tabla.innerHTML = `
            <thead>
                <tr>
                    <th class="col-img ps-3"></th>
                    <th class="col-prod">Producto</th>
                    <th class="col-cant">Cant.</th>
                    <th class="col-sub">Subtotal</th>
                    <th class="col-del text-center"></th>
                </tr>
            </thead>
            <tbody></tbody>
            <tfoot class="table-light">
                <tr>
                    <td colspan="3" class="text-end fw-bold py-3">Total:</td>
                    <td colspan="2" class="ps-3 py-3 fw-bold fs-5 text-primary" id="totalCarritoFinal"></td>
                </tr>
            </tfoot>`;
        
        container.appendChild(tabla);
        const tbody = tabla.querySelector("tbody");

        data.productos.forEach(item => {
            const sub = Number(item.precio_unitario) * Number(item.cantidad);
            totalGeneral += sub;
            const tr = document.createElement("tr");
            tr.className = "cart-item-row";
            
            const imgPath = item.imagen || item.imagen_url;
            const fotoHtml = imgPath 
                ? `<img src="${imgPath}" class="img-preview" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\'img-placeholder\\'><i class=\\'bi bi-box\\'></i></div>';">`
                : `<div class="img-placeholder"><i class="bi bi-box"></i></div>`;

            tr.innerHTML = `
                <td class="ps-3 py-3 col-img">${fotoHtml}</td>
                <td class="col-prod"><strong>${item.nombre_producto}</strong></td>
                <td class="col-cant"><span class="badge-qty">${item.cantidad}</span></td>
                <td class="col-sub">${sub.toLocaleString('es-CO',{style:'currency',currency:'COP', maximumFractionDigits: 0})}</td>
                <td class="col-del text-center">
                    <button class="btn btn-sm btn-outline-danger btn-quitar border-0"><i class="bi bi-trash"></i></button>
                </td>`;
            
            tr.querySelector(".btn-quitar").onclick = async (e) => {
                const btnQuitar = e.currentTarget;
                btnQuitar.disabled = true;
                tr.classList.add("removing");

                const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                if (r.ok) { 
                    setTimeout(() => {
                        cargarCarrito();
                        showMessage("Producto eliminado");
                    }, 400);
                } else {
                    tr.classList.remove("removing");
                    btnQuitar.disabled = false;
                }
            };
            tbody.appendChild(tr);
        });

        const totalEl = document.getElementById("totalCarritoFinal");
        if (totalEl) totalEl.textContent = totalGeneral.toLocaleString('es-CO',{style:'currency',currency:'COP', maximumFractionDigits: 0});

    } catch(e) { 
        console.error(e); 
    }
}

function actualizarContadorBadge(total) {
    const badge = document.getElementById('contadorCarritoBadge');
    const totalInt = parseInt(total) || 0;
    const countAnterior = localStorage.getItem('cant_carrito');
    localStorage.setItem('cant_carrito', totalInt);

    if (badge) {
        if (totalInt > 0) {
            badge.textContent = totalInt > 99 ? '99+' : totalInt;
            badge.style.display = "flex";
            if (countAnterior != totalInt) {
                badge.classList.remove('badge-bounce');
                void badge.offsetWidth; 
                badge.classList.add('badge-bounce');
            }
        } else {
            badge.style.display = "none";
        }
    }
}

async function finalizarCompra() {
    const btn = document.getElementById("btnFinalizarCompra");
    if (!btn) return;
    
    const originalText = `<i class="bi bi-send me-2"></i> Enviar Pedido`;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;

    try {
        const res = await fetch("/finalizar_compra", { 
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 400 && data.completar_perfil) {
                showMessage(data.message);
                setTimeout(() => { window.location.href = "/mi_perfil"; }, 1000);
            } else if (res.status === 400 && data.stock_insuficiente) {
                showMessage(data.message);
                btn.disabled = false;
                btn.innerHTML = originalText;
                await cargarCarrito();
            } else {
                showMessage(data.message || "Error al procesar el pedido");
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return;
        }

        showMessage("¡Pedido enviado con éxito!");
        
        actualizarContadorBadge(0);
        productosCarrito = [];
        
        const modalElement = document.getElementById('modalCarrito');
        if (modalElement) {
            const modalInstance = bootstrap.Modal.getInstance(modalElement);
            if (modalInstance) {
                modalInstance.hide();
            }
        }

        await cargarCarrito();
        
    } catch (error) {
        showMessage("Error de conexión con el servidor");
        btn.disabled = false;
        btn.innerHTML = originalText;
    } finally {
        if (btn && btn.innerHTML.includes("Procesando") && (typeof productosCarrito !== 'undefined' && productosCarrito.length > 0)) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function monitorearCambiosFacturas() {
    const inputBuscar = document.getElementById("buscarFactura");
    const cedula = inputBuscar ? inputBuscar.value.trim() : "";
    if (!cedula) return;

    try {
        const res = await fetch(`/buscar_facturas?cedula=${cedula}`);
        if (!res.ok) return;
        
        const facturasServidor = await res.json();
        const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
        
        if (facturasLocalesCache.length > 0) {
            facturasServidor.forEach(fServ => {
                const fLocal = facturasLocalesCache.find(l => l.id_factura === fServ.id_factura);
                if (fLocal && fLocal.estado !== fServ.estado) {
                    lanzarNotificacionMultidispositivo(fServ, fServ.estado);
                }
            });
        }

        facturasLocalesCache = facturasServidor;
        facturasActuales = facturasServidor
            .filter(f => !ocultas.includes(f.id_factura))
            .sort((a, b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
            
        mostrarFacturasBuscadas();

    } catch (e) {
        console.error("Error en sincronización:", e);
    }
}

function generarReferenciaVisual(f) {
    const fechaEmi = new Date(f.fecha_emision);
    const anio = fechaEmi.getFullYear();
    const idReal = f.id_factura;
    return `F-${anio}-${idReal}`;
}

function lanzarNotificacionMultidispositivo(fObj, estado) {
    playNotificationSound();
    
    const facturaFormateada = generarReferenciaVisual(fObj);
    const estadoL = estado.toLowerCase();
    
    let configuracion = {
        color: "primary",
        icono: "bi-info-circle-fill",
        titulo: "Actualización de Pedido"
    };

    if (["anulada", "cancelado", "cancelada"].includes(estadoL)) {
        configuracion = { color: "danger", icono: "bi-x-circle-fill", titulo: "Pedido Anulado" };
    } else if (["pagada", "pagado"].includes(estadoL)) {
        configuracion = { color: "success", icono: "bi-check-circle-fill", titulo: "Pago Confirmado" };
    } else if (["emitida", "emitido"].includes(estadoL)) {
        configuracion = { color: "info", icono: "bi-send-fill", titulo: "Pedido Emitido" };
    } else if (estadoL === "enviado") {
        configuracion = { color: "warning", icono: "bi-truck", titulo: "Pedido en Camino" };
    } else if (["finalizado", "entregado"].includes(estadoL)) {
        configuracion = { color: "info", icono: "bi-house-check-fill", titulo: "Pedido Entregado" };
    }

    if (Notification.permission === "granted") {
        new Notification(configuracion.titulo, {
            body: `Tu factura ${facturaFormateada} ha pasado al estado: ${estado}`,
            icon: "/static/uploads/logo.png"
        });
    }

    const cont = document.getElementById("toastContainer");
    if (!cont) return;

    const t = document.createElement("div");
    t.className = `custom-toast bg-dark text-white border-0 shadow-lg mb-2`;
    t.style.borderLeft = `5px solid var(--bs-${configuracion.color})`;
    t.style.minWidth = "300px";
    t.style.transition = "opacity 0.4s ease";
    
    t.innerHTML = `
        <div class="d-flex align-items-center p-2">
            <i class="bi ${configuracion.icono} text-${configuracion.color} fs-4 me-3"></i>
            <div class="flex-grow-1">
                <strong style="font-size: 0.85rem;" class="d-block">${configuracion.titulo}</strong>
                <small class="text-white-50">Factura ${facturaFormateada}: </small>
                <span class="badge bg-${configuracion.color} text-dark" style="font-size: 0.65rem;">${estado.toUpperCase()}</span>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
        </div>`;
        
    cont.appendChild(t);

    const remove = () => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 400);
    };

    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 7000);
}

function generarNumeroFactura(idPedido, fecha) {
    const year = new Date(fecha).getFullYear();
    const key = `${year}-${idPedido}`;
    let contadorFacturasPorAnio = JSON.parse(localStorage.getItem("contadorFacturasPorAnio") || "{}");
    
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

let estadosFacturasPrevios = {};

function mostrarFacturasBuscadas() {
    const container = document.getElementById("facturasContainer");
    if (!container) return;
    container.innerHTML = "";
    
    const filtroEstado = document.getElementById("filtroEstado")?.value || "";
    const busquedaNombre = document.getElementById("inputBusquedaNombre")?.value.toLowerCase().trim() || "";
    const busquedaCedula = document.getElementById("inputBusquedaCedula")?.value.trim() || "";
    
    const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");

    let filtradas = facturasActuales.filter(f => {
        if (ocultas.includes(f.id_factura)) return false;

        const idPropietario = f.id_cliente || (f.usuarios ? f.usuarios.id_usuario : null);
        
        if (typeof idUsuarioLogueado !== 'undefined' && idUsuarioLogueado !== null) {
            if (String(idPropietario) !== String(idUsuarioLogueado)) return false;
        }

        const estadoNormalizado = f.estado ? f.estado.toLowerCase() : "";
        
        const idFacturaStr = String(f.id_factura);
        const esAnuladaAhora = ["anulada", "cancelado", "cancelada"].includes(estadoNormalizado);
        
        if (estadosFacturasPrevios[idFacturaStr] !== undefined) {
            const estadoAnterior = estadosFacturasPrevios[idFacturaStr];
            const eraAnulada = ["anulada", "cancelado", "cancelada"].includes(estadoAnterior.toLowerCase());
            
            if (esAnuladaAhora && !eraAnulada) {
                const numFact = generarNumeroFactura(f.id_factura, f.fecha_emision);
                showMessage(` EL PEDIDO ${numFact} HA SIDO CANCELADO`);
            }
        }
        estadosFacturasPrevios[idFacturaStr] = estadoNormalizado;

        const matchEstado = filtroEstado === "" || estadoNormalizado === filtroEstado.toLowerCase();
        const usuario = f.usuarios || {};
        const nombreCompleto = `${usuario.nombre || ''} ${usuario.apellido || ''}`.toLowerCase();
        const cedulaUsuario = String(usuario.cedula || '');

        const matchNombre = busquedaNombre === "" || nombreCompleto.includes(busquedaNombre);
        const matchCedula = busquedaCedula === "" || cedulaUsuario.includes(busquedaCedula);

        return matchEstado && matchNombre && matchCedula;
    });
    
    const paginadas = filtradas.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina);

    if (paginadas.length === 0) {
        container.innerHTML = `
            <div class="text-center p-5 text-muted bg-white rounded-4 shadow-sm">
                <i class="bi bi-search fs-1"></i>
                <p class="mt-2">No se encontraron facturas vinculadas a su cuenta</p>
            </div>`;
        return;
    }

    paginadas.forEach((f) => {
        const card = document.createElement("div");
        const estadoRaw = f.estado || "";
        
        const esPagada = ["pagado", "pagada", "finalizado", "entregado", "enviado"].includes(estadoRaw.toLowerCase());
        const esAnulada = ["anulada", "cancelado", "cancelada"].includes(estadoRaw.toLowerCase());
        const esEstadoFinal = esPagada || esAnulada;
        
        const facturaFormateada = generarNumeroFactura(f.id_factura, f.fecha_emision);

        let detalleHtml = "";
        let totalCalculado = 0;
        (f.productos || []).forEach(p => {
            const sub = Number(p.subtotal || 0);
            totalCalculado += sub;
            detalleHtml += `
                <div class="item-row d-flex justify-content-between border-bottom py-1">
                    <span class="text-dark text-truncate" style="max-width: 150px;">${p.nombre_producto}</span>
                    <span class="text-muted small">x${p.cantidad}</span>
                    <span class="fw-bold">${sub.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0})}</span>
                </div>`;
        });

        let colorBadge = "primary";
        let iconoEstado = "bi-clock-history";
        let textoEstadoMostrar = estadoRaw;

        if (esAnulada) {
            colorBadge = "danger";
            iconoEstado = "bi-x-circle";
            textoEstadoMostrar = "ANULADA";
        } else if (esPagada) {
            colorBadge = "success";
            iconoEstado = "bi-check-circle-fill";
            textoEstadoMostrar = "PAGADA"; 
        } else if (estadoRaw.toLowerCase().includes("emitid")) {
            colorBadge = "info";
            iconoEstado = "bi-send";
        }

        card.className = `card card-factura mb-4 shadow-sm ${esEstadoFinal ? 'factura-bloqueada' : ''}`;
        card.id = `factura-card-${f.id_factura}`;
        card.innerHTML = `
            <div class="factura-header p-3 border-bottom">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="rounded-circle bg-dark text-white d-flex align-items-center justify-content-center me-3" style="width:40px; height:40px;">
                            <i class="bi bi-receipt fs-5"></i>
                        </div>
                        <div>
                            <h6 class="fw-bold mb-0">${facturaFormateada}</h6>
                            <small class="text-primary fw-bold">CC: ${f.usuarios?.cedula || 'No registrada'}</small>
                        </div>
                    </div>
                    <span class="badge bg-${colorBadge} d-flex align-items-center gap-1 py-2 px-3 rounded-pill">
                        <i class="bi ${iconoEstado}"></i> ${textoEstadoMostrar.toUpperCase()}
                    </span>
                </div>
            </div>
            <div class="card-body p-3">
                <div class="mb-2 small text-uppercase text-muted fw-bold" style="letter-spacing: 0.5px;">Resumen del pedido</div>
                <div class="lista-productos mb-3">${detalleHtml}</div>
                <div class="text-end border-top pt-2">
                    <div class="small text-muted mb-0" style="font-size: 0.7rem;">TOTAL NETO: </div>
                    <div class="fw-bold fs-4 text-primary">${totalCalculado.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0})}</div>
                </div>
                <div class="mt-3 seccion-accion">
                    ${(!esEstadoFinal) ? `
                        <button class="btn btn-primary w-100 fw-bold rounded-pill btn-pagar-modal-factura py-2">
                            <i class="bi bi-qr-code me-2"></i>Pagar Ahora
                        </button>
                    ` : `
                        <div class="p-2 border rounded-3 bg-light text-center ${esAnulada ? 'text-danger' : 'text-success'} small fw-bold">
                            <i class="bi ${esAnulada ? 'bi-x-octagon' : 'bi-shield-check'} me-1"></i> ${esAnulada ? 'PEDIDO CANCELADO' : 'TRANSACCIÓN FINALIZADA'}
                        </div>
                    `}
                </div>
            </div>
            <div class="card-footer bg-transparent border-top-0 p-3">
                <div class="d-flex gap-2">
                    <button class="btn btn-sm btn-dark flex-grow-1 btn-pdf-action">
                        <i class="bi bi-file-earmark-pdf"></i> PDF
                    </button>
                    ${(!esEstadoFinal) ? 
                        `<button class="btn btn-sm btn-outline-danger flex-grow-1 btn-anular-action">Anular</button>` : 
                        `<button class="btn btn-sm btn-link text-muted text-decoration-none flex-grow-1 btn-eliminar-action"><i class="bi bi-trash"></i> Quitar</button>`
                    }
                </div>
            </div>`;
        
        if (card.querySelector('.btn-pagar-modal-factura')) {
            card.querySelector('.btn-pagar-modal-factura').onclick = (e) => {
                e.preventDefault();
                abrirModalPago(facturaFormateada, totalCalculado.toLocaleString('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}));
            };
        }

        card.querySelector('.btn-pdf-action').onclick = () => {
            f.numero_factura_visual = facturaFormateada;
            f.numero_factura = facturaFormateada;
            descargarPDF(f);
        };
        
        const btnAnular = card.querySelector('.btn-anular-action');
        if (btnAnular) {
            btnAnular.onclick = async () => {
                const exito = await anularFactura(f.id_factura);
                if (exito) {
                    f.estado = "Cancelado";
                    showMessage("Factura anulada con éxito");
                    setTimeout(() => {
                        mostrarFacturasBuscadas();
                    }, 300);
                }
            };
        }
        
        const btnEliminar = card.querySelector('.btn-eliminar-action');
        if (btnEliminar) {
            btnEliminar.onclick = () => {
                const actualesOcultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
                if (!actualesOcultas.includes(f.id_factura)) {
                    actualesOcultas.push(f.id_factura);
                    localStorage.setItem('facturas_ocultas', JSON.stringify(actualesOcultas));
                }
                facturasActuales = facturasActuales.filter(fact => fact.id_factura !== f.id_factura);
                mostrarFacturasBuscadas();
                showMessage("Vista actualizada");
            };
        }
        
        container.appendChild(card);
    });
    paginar(filtradas.length);
}

async function anularFactura(idFactura) {
    return new Promise((resolve) => {
        showConfirmToast("¿Estás seguro de que deseas anular este pedido?", async () => {
            try {
                const res = await fetch(`/facturas/${idFactura}/anular`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" }
                });
                const data = await res.json();
                if (res.ok) {
                    if (typeof monitorearCambiosFacturas === 'function') await monitorearCambiosFacturas();
                    resolve(true);
                } else {
                    showMessage(data.message || "No se pudo anular", true);
                    resolve(false);
                }
            } catch (error) {
                showMessage("Error de conexión", true);
                resolve(false);
            }
        });
    });
}

function paginar(total) {
    const p = document.getElementById("paginacion");
    if (!p) return;
    p.innerHTML = "";
    for (let i = 1; i <= Math.ceil(total / itemsPorPagina); i++) {
        const li = document.createElement("li");
        li.className = `page-item ${i === paginaActual ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
        li.onclick = (e) => { e.preventDefault(); paginaActual = i; mostrarFacturasBuscadas(); };
        p.appendChild(li);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const savedCount = localStorage.getItem('cant_carrito');
    if (savedCount && parseInt(savedCount) > 0) {
        actualizarContadorBadge(savedCount);
    }
    
    cargarCarrito();
    cargarMetodosPago();

    if (Notification.permission !== "granted") {
        Notification.requestPermission();
    }

    const btnFinalizar = document.getElementById("btnFinalizarCompra");
    if (btnFinalizar) btnFinalizar.onclick = finalizarCompra;

    const inputBuscar = document.getElementById("buscarFactura");
    if (inputBuscar) {
        inputBuscar.oninput = async function() {
            const val = this.value.trim();
            if (!val) { facturasActuales = []; mostrarFacturasBuscadas(); return; }
            const res = await fetch(`/buscar_facturas?cedula=${val}`);
            if (res.ok) {
                const facturas = await res.json();
                const ocultas = JSON.parse(localStorage.getItem('facturas_ocultas') || "[]");
                facturasActuales = facturas
                    .filter(f => !ocultas.includes(f.id_factura))
                    .sort((a,b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
                paginaActual = 1;
                mostrarFacturasBuscadas();
            }
        };
    }

    const filtroEstado = document.getElementById("filtroEstado");
    if (filtroEstado) filtroEstado.onchange = mostrarFacturasBuscadas;

    setInterval(verificarCambiosCatalogoYCarrito, 3000);
    setInterval(monitorearCambiosFacturas, 4000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}