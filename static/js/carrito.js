let facturasActuales = [];
let paginaActual = 1;
const itemsPorPagina = 5;
let productosCarrito = [];

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
    setTimeout(remove, 4000);
}

async function verificarStockCarrito() {
    try {
        const resCarrito = await fetch("/obtener_carrito");
        if (!resCarrito.ok) return;
        const miCarrito = await resCarrito.json();
        
        const resCatalogo = await fetch("/obtener_catalogo");
        if (!resCatalogo.ok) return;
        const catalogo = await resCatalogo.json();

        if (miCarrito.productos && miCarrito.productos.length > 0) {
            miCarrito.productos.forEach(itemCarrito => {
                const productoReal = catalogo.productos.find(p => p.id_producto == itemCarrito.id_producto);
                
                if (productoReal) {
                    const itemAnterior = productosCarrito.find(p => p.id_producto == itemCarrito.id_producto);
                    
                    if (itemAnterior) {
                        if (itemAnterior.stock_disponible > 0 && productoReal.stock <= 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Agotado",
                                `${itemCarrito.nombre_producto} ya no está disponible`,
                                true
                            );
                        } else if (itemAnterior.stock_disponible <= 0 && productoReal.stock > 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Producto Disponible",
                                `${itemCarrito.nombre_producto} vuelve a estar disponible`
                            );
                        } else if (itemAnterior.stock_disponible > productoReal.stock && productoReal.stock > 0) {
                            mostrarToastPublicidad(
                                itemCarrito.imagen || itemCarrito.imagen_url || '/static/uploads/default.png',
                                "Stock Reducido",
                                `${itemCarrito.nombre_producto} ahora tiene ${productoReal.stock} unidades`,
                                true
                            );
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

            productosCarrito = productosCarrito.filter(p => 
                miCarrito.productos.some(c => c.id_producto == p.id_producto)
            );
        }
    } catch (e) {
        console.error("Error verificando stock:", e);
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
            if (btn) btn.style.display = "none";
            return;
        }

        let totalGeneral = 0;
        const tabla = document.createElement("table");
        tabla.className = "table align-middle mb-0";
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
            tr.style.transition = "all 0.4s ease";
            
            const imgPath = item.imagen || item.imagen_url;
            const fotoHtml = imgPath 
                ? `<img src="${imgPath}" class="img-preview me-3" width="45" height="45" style="object-fit:cover; border-radius: 8px;" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\'me-3 bg-light d-flex align-items-center justify-content-center\' style=\'width:45px; height:45px; border-radius:8px;\'><i class=\'bi bi-box\'></i></div>';">`
                : `<div class="me-3 bg-light d-flex align-items-center justify-content-center" style="width:45px; height:45px; border-radius:8px;"><i class="bi bi-box"></i></div>`;

            tr.innerHTML = `
                <td class="ps-4 py-3">
                    <div class="d-flex align-items-center">
                        ${fotoHtml}
                        <strong>${item.nombre_producto}</strong>
                    </div>
                </td>
                <td><span class="badge bg-light text-dark border">x${item.cantidad}</span></td>
                <td>${Number(item.precio_unitario).toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                <td>${sub.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                <td class="text-center"><button class="btn btn-sm btn-outline-danger btn-quitar"><i class="bi bi-trash"></i></button></td>`;
            
            tr.querySelector(".btn-quitar").onclick = async (e) => {
                const btnQuitar = e.currentTarget;
                btnQuitar.disabled = true;
                btnQuitar.innerHTML = `<span class="spinner-border spinner-border-sm"></span>`;

                const r = await fetch(`/carrito_quitar/${item.id_carrito}`, { method: "DELETE" });
                if (r.ok) { 
                    tr.style.opacity = "0";
                    tr.style.transform = "translateX(20px)";
                    setTimeout(() => {
                        cargarCarrito();
                        showMessage("Producto eliminado");
                    }, 400);
                } else {
                    btnQuitar.disabled = false;
                    btnQuitar.innerHTML = `<i class="bi bi-trash"></i>`;
                }
            };
            tbody.appendChild(tr);
        });

        const totalEl = document.getElementById("totalCarritoFinal");
        if (totalEl) totalEl.textContent = totalGeneral.toLocaleString('es-CO',{style:'currency',currency:'COP'});
        if (btn) btn.style.display = "inline-block";

    } catch(e) { console.error(e); }
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

document.addEventListener('DOMContentLoaded', () => {
    const savedCount = localStorage.getItem('cant_carrito');
    if (savedCount && parseInt(savedCount) > 0) {
        actualizarContadorBadge(savedCount);
    }
    cargarCarrito();
    
    setInterval(verificarStockCarrito, 3000);
});

async function finalizarCompra() {
    const btn = document.getElementById("btnFinalizarCompra");
    if (!btn) return;
    const originalText = btn.innerHTML;
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
                showMessage(data.message, true);
                setTimeout(() => { window.location.href = "/mi_perfil"; }, 1000);
            } else if (res.status === 400 && data.stock_insuficiente) {
                showMessage(data.message, true);
                btn.disabled = false;
                btn.innerHTML = originalText;
                await cargarCarrito();
            } else {
                showMessage(data.message || "Error al procesar el pedido", true);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return;
        }

        showMessage("¡Pedido enviado con éxito!");
        actualizarContadorBadge(0);
        productosCarrito = [];
        await cargarCarrito();
        
    } catch (error) {
        showMessage("Error de conexión con el servidor", true);
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
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
            facturasActuales = (await res.json()).sort((a,b) => new Date(b.fecha_emision) - new Date(a.fecha_emision));
            paginaActual = 1;
            mostrarFacturasBuscadas();
        }
    };
}

function mostrarFacturasBuscadas() {
    const container = document.getElementById("facturasContainer");
    if (!container) return;
    container.innerHTML = "";
    const filtro = document.getElementById("filtroEstado");
    const filter = filtro ? filtro.value : "";
    
    let filtradas = facturasActuales;
    if (filter && filter !== "") filtradas = facturasActuales.filter(f => f.estado === filter);
    const inicio = (paginaActual - 1) * itemsPorPagina;
    const paginadas = filtradas.slice(inicio, inicio + itemsPorPagina);

    if (paginadas.length === 0) {
        container.innerHTML = '<p class="text-center p-4">No se encontraron registros.</p>';
        return;
    }

    paginadas.forEach(f => {
        const card = document.createElement("div");
        card.className = "card mb-4 border-0 shadow-sm rounded-4 overflow-hidden";
        let filas = "";
        let total = 0;
        (f.productos || []).forEach(p => {
            total += Number(p.subtotal);
            filas += `
                <tr>
                    <td><span>${p.nombre_producto}</span></td>
                    <td class="text-center">x${p.cantidad}</td>
                    <td class="text-end">${Number(p.subtotal).toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
                </tr>`;
        });

        const userImg = f.imagen_usuario 
            ? `<img src="${f.imagen_usuario}" class="rounded-circle me-3 shadow-sm border border-2 border-white" width="45" height="45" style="object-fit:cover;" onerror="this.onerror=null; this.src='https://cdn-icons-png.flaticon.com/512/149/149071.png';">`
            : `<div class="rounded-circle me-3 bg-secondary d-flex align-items-center justify-content-center shadow-sm" style="width:45px; height:45px;"><i class="bi bi-person text-white"></i></div>`;

        card.innerHTML = `
            <div class="card-header bg-white pt-4 px-4 border-0">
                <div class="d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        ${userImg}
                        <div>
                            <h6 class="fw-bold mb-0">Factura #${f.numero_factura}</h6>
                            <small class="text-muted">${new Date(f.fecha_emision).toLocaleString()}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                         <button class="btn btn-sm btn-dark btn-pdf px-3"><i class="bi bi-download"></i> PDF</button>
                         <span class="badge bg-dark rounded-pill px-3">${f.estado}</span>
                    </div>
                </div>
            </div>
            <div class="card-body px-4">
                <table class="table table-sm table-borderless align-middle mb-0">
                    <thead>
                        <tr class="text-muted small border-bottom">
                            <th>PRODUCTO</th>
                            <th class="text-center">CANT.</th>
                            <th class="text-end">SUBTOTAL</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <div class="card-footer bg-light border-0 p-4">
                <div class="d-flex justify-content-between align-items-center">
                    <button class="btn btn-sm btn-link text-danger p-0 btn-anular fw-bold" ${f.estado==='Anulada'?'disabled':''} style="text-decoration:none;">Anular pedido</button>
                    <div class="text-end">
                        <small class="text-muted d-block">Total a pagar</small>
                        <span class="fw-bold fs-5 text-primary">${total.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</span>
                    </div>
                </div>
            </div>`;
        
        card.querySelector(".btn-pdf").onclick = () => descargarPDF(f);
        card.querySelector(".btn-anular").onclick = async () => {
            if (confirm("¿Anular pedido?")) {
                const r = await fetch(`/facturas/${f.id_factura}/anular`, { method: "PUT" });
                if (r.ok) { showMessage("Pedido anulado"); f.estado = "Anulada"; mostrarFacturasBuscadas(); }
            }
        };
        container.appendChild(card);
    });
    paginar(filtradas.length);
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

const filtroEstado = document.getElementById("filtroEstado");
if (filtroEstado) filtroEstado.onchange = mostrarFacturasBuscadas;

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-carrito.js')
        .then(reg => {
            console.log('SW registrado correctamente');
        })
        .catch(error => {
            console.error('Error al registrar el SW:', error);
        });
    });
}