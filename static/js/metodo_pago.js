let metodosPagoArray = [];
let editIndex = -1;

const IMG_DEFAULT = "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Cline x1='3' y1='9' x2='21' y2='9'%3E%3C/line%3E%3Cline x1='9' y1='21' x2='9' y2='9'%3E%3C/line%3E%3Cpath d='M7 14l2 2 4-4'%3E%3C/path%3E%3C/svg%3E";

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

document.addEventListener('DOMContentLoaded', async () => {
    const tieneAcceso = await verificarAccesoAdmin();
    if (!tieneAcceso) return;

    cargarMetodosDesdeHTML();

    const archivoQR = document.getElementById('archivoQR');
    if (archivoQR) {
        archivoQR.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    document.getElementById('previewPagoImg').src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
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
});

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
        mostrarToastApp("Complete número y titular", "warning");
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
        mostrarToastApp("Método actualizado correctamente", "info");
    } else {
        metodosPagoArray.push(datosMetodo);
        mostrarToastApp("Añadido a la lista de espera", "info");
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

    if (m.file) {
        document.getElementById('previewPagoImg').src = URL.createObjectURL(m.file);
    } else if (m.url_actual) {
        document.getElementById('previewPagoImg').src = m.url_actual;
    } else {
        document.getElementById('previewPagoImg').src = IMG_DEFAULT;
    }

    const btn = document.getElementById('btnAgregarTemporal');
    btn.innerHTML = `<i class="bi bi-check-circle-fill"></i> ACTUALIZAR CAMBIOS EN LISTA`;
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
        let imgSrc = IMG_DEFAULT;

        if (m.file) {
            imgSrc = URL.createObjectURL(m.file);
        } else if (m.url_actual) {
            imgSrc = m.url_actual;
        }

        lista.innerHTML += `
            <div class="col-12 col-md-6 animate__animated animate__fadeIn">
                <div class="metodo-card p-3 shadow-sm d-flex align-items-center justify-content-between">
                    <div class="d-flex align-items-center gap-3">
                        <img src="${imgSrc}" class="rounded border" style="width:55px; height:55px; object-fit:cover;">
                        <div>
                            <span class="bank-badge ${badgeClass} mb-1">${m.entidad}</span>
                            <h6 class="m-0 fw-bold">${m.titular}</h6>
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
}

async function guardarCambiosPagos() {
    const btn = document.getElementById('btnGuardarPagos');
    const originalContent = btn.innerHTML;
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
        const response = await fetch("/zona_pagos_page", {
            method: "POST",
            body: formData
        });
        const result = await response.json();

        if (result.ok) {
            mostrarToastApp("¡Cambios guardados globalmente!", "success");
            setTimeout(() => location.reload(), 1500);
        } else {
            throw new Error(result.error);
        }
    } catch (error) {
        mostrarToastApp("Error: " + error.message, "danger");
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

function mostrarToastApp(msj, tipo) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const id = Date.now();
    const html = `
        <div id="toast-${id}" class="alert alert-${tipo} shadow-lg border-0 mb-2 animate__animated animate__fadeInRight" style="min-width:280px;">
            <div class="d-flex align-items-center">
                <i class="bi bi-info-circle-fill me-2 fs-5"></i>
                <span class="small fw-bold">${msj}</span>
            </div>
        </div>`;
    container.insertAdjacentHTML('beforeend', html);
    setTimeout(() => {
        const t = document.getElementById(`toast-${id}`);
        if (t) t.remove();
    }, 4000);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-zona_pagos.js')
        .then(() => { console.log('SW OK'); })
        .catch(() => { console.log('SW Error'); });
    });
}