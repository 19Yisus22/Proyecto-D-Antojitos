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
    showMessage("PDF generado y descargado correctamente");
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
});

async function finalizarCompra() {
    const btn = document.getElementById("btnFinalizarCompra");
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Validando Stock...`;

    try {
        const checkRes = await fetch("/obtener_catalogo");
        const catalogo = await checkRes.json();
        const resCarrito = await fetch("/obtener_carrito");
        const miCarrito = await resCarrito.json();

        let stockInsuficiente = false;
        miCarrito.productos.forEach(item => {
            const pReal = catalogo.productos.find(p => p.id_producto == item.id_producto);
            if (pReal && item.cantidad > pReal.stock) {
                stockInsuficiente = true;
                showMessage(`Stock insuficiente para ${item.nombre_producto}. Disponible: ${pReal.stock}`, true);
            }
        });

        if (stockInsuficiente) {
            btn.disabled = false;
            btn.innerHTML = originalText;
            await cargarCarrito();
            return;
        }

        btn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...`;
        const res = await fetch("/finalizar_compra", { 
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });
        const data = await res.json();

        if (!res.ok) {
            if (res.status === 400 && data.completar_perfil) {
                showMessage(data.message, true);
                setTimeout(() => { window.location.href = "/mi_perfil"; }, 1000);
            } else {
                showMessage(data.message || "Error al procesar el pedido", true);
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
            return;
        }

        showMessage("¡Pedido enviado con éxito!");
        actualizarContadorBadge(0);
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
                        <small class="text-muted d-block">Total pagado</small>
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
        .then(reg => { console.log('SW registrado'); })
        .catch(error => { console.error('Error SW:', error); });
    });
}