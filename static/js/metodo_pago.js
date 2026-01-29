let metodosPagoArray = [];
let editIndex = -1;

const IMG_DEFAULT = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";

document.addEventListener('DOMContentLoaded', async () => {
    const tieneAcceso = await verificarAccesoAdmin();
    if (!tieneAcceso) return;

    cargarMetodosDesdeHTML();
    escucharEventosTiempoReal();

    const archivoQR = document.getElementById('archivoQR');
    const previewImg = document.getElementById('previewPagoImg');

    if (archivoQR && previewImg) {
        archivoQR.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
            } else {
                previewImg.src = IMG_DEFAULT;
            }
        });
    }

    const btnGuardar = document.getElementById('btnGuardarPagos');
    if (btnGuardar) {
        btnGuardar.addEventListener('click', guardarCambiosPagos);
    }
    
    const btnAgregar = document.getElementById('btnAgregarTemporal');
    if (btnAgregar) {
        btnAgregar.addEventListener('click', agregarMetodoPago);
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
                    showMessage(result.error || "Error al actualizar", true);
                } else {
                    showMessage("Estado de pago actualizado", false);
                }
            } catch (error) {
                e.target.checked = !estaPagado;
                showMessage("Error de comunicación con el servidor", true);
            }
        }
    });
});

function showMessage(msg, isError = false) {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement("div");
        container.id = "toastContainer";
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `custom-toast animate__animated animate__fadeInRight`;
    
    const icon = isError ? 'bi-exclamation-triangle-fill' : 'bi-check-circle-fill';
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon-wrapper">
                <i class="bi ${icon}"></i>
            </div>
            <div class="toast-text">
                <span class="toast-main-text">${msg}</span>
            </div>
            <i class="bi bi-x-lg toast-close btn-close-toast"></i>
        </div>
    `;
    
    container.appendChild(toast);

    const remove = () => {
        toast.classList.replace('animate__fadeInRight', 'animate__fadeOutRight');
        setTimeout(() => toast.remove(), 400);
    };

    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 4000);
}

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

function escucharEventosTiempoReal() {
    window.addEventListener('storage', (e) => {
        if (e.key === 'nuevoPedidoDetectado') {
            showMessage("¡Nuevo pedido detectado!", false);
        }
        if (e.key === 'pedidoAnuladoRecientemente') {
            showMessage("Un pedido ha sido anulado", true);
        }
    });
}

function cargarMetodosDesdeHTML() {
    const res = document.getElementById('metodos_iniciales_data');
    if (res && res.value && res.value !== 'None' && res.value !== '') {
        try {
            const data = JSON.parse(res.value);
            metodosPagoArray = data.map(m => ({
                entidad: m.entidad,
                tipo_cuenta: m.tipo_cuenta,
                numero: m.numero,
                titular: m.titular,
                url_actual: m.qr_url,
                cambio_img: false,
                file: null
            }));
            renderizarLista();
        } catch (e) {
            metodosPagoArray = [];
        }
    }
}

function agregarMetodoPago() {
    const entidad = document.getElementById('entidadBancaria').value;
    const tipo = document.getElementById('tipoCuenta').value;
    const numero = document.getElementById('numeroCuenta').value.trim();
    const titular = document.getElementById('titularCuenta').value.trim();
    const fileInput = document.getElementById('archivoQR');

    if (!numero || !titular) {
        showMessage("Debes completar número y titular", true);
        return;
    }

    const tieneArchivo = fileInput.files && fileInput.files[0];
    const datosMetodo = {
        entidad: entidad,
        tipo_cuenta: tipo,
        numero: numero,
        titular: titular,
        url_actual: editIndex !== -1 ? metodosPagoArray[editIndex].url_actual : "",
        cambio_img: tieneArchivo ? true : (editIndex !== -1 ? metodosPagoArray[editIndex].cambio_img : false),
        file: tieneArchivo ? fileInput.files[0] : (editIndex !== -1 ? metodosPagoArray[editIndex].file : null)
    };

    if (editIndex !== -1) {
        metodosPagoArray[editIndex] = datosMetodo;
        showMessage("Método actualizado en la lista");
    } else {
        metodosPagoArray.push(datosMetodo);
        showMessage("Añadido a la lista de espera");
    }

    resetearFormulario();
    renderizarLista();
}

function editarMetodo(index) {
    const m = metodosPagoArray[index];
    editIndex = index;

    document.getElementById('entidadBancaria').value = m.entidad;
    document.getElementById('tipoCuenta').value = m.tipo_cuenta;
    document.getElementById('numeroCuenta').value = m.numero;
    document.getElementById('titularCuenta').value = m.titular;

    const preview = document.getElementById('previewPagoImg');
    if (m.file) {
        preview.src = URL.createObjectURL(m.file);
    } else {
        preview.src = m.url_actual || IMG_DEFAULT;
    }

    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ACTUALIZAR EN LISTA`;
    btn.classList.replace('btn-primary', 'btn-warning');

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderizarLista() {
    const lista = document.getElementById('listaMetodosPago');
    const previewContenedor = document.getElementById('previewContenedorFinal');

    if (!lista || !previewContenedor) return;

    lista.innerHTML = "";
    previewContenedor.innerHTML = "";

    metodosPagoArray.forEach((m, index) => {
        const badgeClass = getBadgeClass(m.entidad);
        const imgSrc = m.file ? URL.createObjectURL(m.file) : (m.url_actual || IMG_DEFAULT);

        lista.innerHTML += `
            <div class="col-12 col-md-6 animate__animated animate__fadeIn">
                <div class="metodo-card p-3 shadow-sm d-flex align-items-center justify-content-between border rounded mb-2 bg-white">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${imgSrc}" class="rounded border" style="width:55px; height:55px; object-fit:cover;">
                        <div>
                            <span class="bank-badge ${badgeClass} mb-1">${m.entidad}</span>
                            <h6 class="m-0 fw-bold text-dark">${m.titular}</h6>
                            <small class="text-muted d-block">${m.numero}</small>
                        </div>
                    </div>
                    <div class="d-flex gap-2">
                        <button class="btn btn-outline-primary btn-sm border-0" onclick="editarMetodo(${index})">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="btn btn-outline-danger btn-sm border-0" onclick="eliminarFila(${index})">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>
                </div>
            </div>`;

        previewContenedor.innerHTML += `
            <div class="col-6 text-center mb-3">
                <div class="p-2 border rounded bg-light h-100">
                    <img src="${imgSrc}" class="img-fluid rounded mb-2" style="max-height:95px; width: 100%; object-fit: contain; background: white;">
                    <p class="small fw-bold m-0" style="font-size:11px;">${m.entidad}</p>
                    <p class="small text-muted m-0" style="font-size:10px;">${m.numero}</p>
                </div>
            </div>`;
    });
}

function eliminarFila(index) {
    metodosPagoArray.splice(index, 1);
    if (editIndex === index) resetearFormulario();
    renderizarLista();
    showMessage("Método eliminado de la lista", true);
}

async function guardarCambiosPagos() {
    const btn = document.getElementById('btnGuardarPagos');
    const originalContent = btn.innerHTML;
    
    if (metodosPagoArray.length === 0) {
        showMessage("No hay métodos para guardar", true);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> SINCRONIZANDO...`;

    const formData = new FormData();
    const metadata = metodosPagoArray.map(m => ({
        entidad: m.entidad,
        tipo_cuenta: m.tipo_cuenta,
        numero: m.numero,
        titular: m.titular,
        url_actual: m.url_actual,
        cambio_img: m.cambio_img
    }));

    formData.append("metadata_pagos", JSON.stringify(metadata));

    metodosPagoArray.forEach((m) => {
        if (m.cambio_img && m.file) {
            formData.append(`imagenes_qr`, m.file);
        }
    });

    try {
        const response = await fetch("/facturacion_page", {
            method: "POST",
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
            body: formData
        });

        if (!response.ok) throw new Error("Error en la comunicación con el servidor");

        const result = await response.json();

        if (result.ok) {
            showMessage("¡Cambios aplicados correctamente!");
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(result.error || "No se pudieron guardar los cambios");
        }
    } catch (error) {
        showMessage(error.message, true);
        btn.disabled = false;
        btn.innerHTML = originalContent;
    }
}

function resetearFormulario() {
    editIndex = -1;
    document.getElementById('numeroCuenta').value = "";
    document.getElementById('titularCuenta').value = "";
    document.getElementById('archivoQR').value = "";
    document.getElementById('previewPagoImg').src = IMG_DEFAULT;
    document.getElementById('entidadBancaria').selectedIndex = 0;
    document.getElementById('tipoCuenta').selectedIndex = 0;

    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-node-plus-fill"></i> AGREGAR A LA LISTA TEMPORAL`;
    btn.classList.replace('btn-warning', 'btn-primary');
}

function getBadgeClass(entidad) {
    const classes = {
        'Nequi': 'nequi-bg',
        'Daviplata': 'daviplata-bg',
        'Bancolombia': 'bancolombia-bg',
        'NuBank': 'nubank-bg'
    };
    return classes[entidad] || 'bg-secondary text-white';
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-zona_pagos.js')
        .then(() => console.log('SW OK'))
        .catch(() => console.log('SW Error'));
    });
}