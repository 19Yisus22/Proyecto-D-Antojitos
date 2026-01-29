let carruselIndex = 0, seccionIndex = 0, cintaIndex = 0;
let procesamientoEnCurso = false;

function toast(msg, tipo = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "custom-toast";
    let icon = tipo === "success" ? "bi-check-circle-fill" : (tipo === "warning" ? "bi-exclamation-circle-fill" : "bi-exclamation-triangle-fill");
    let iconColor = tipo === "success" ? "#2ecc71" : (tipo === "warning" ? "#f1c40f" : "#e74c3c");
    div.innerHTML = `
        <div class="d-flex align-items-center gap-3">
            <i class="bi ${icon}" style="color: ${iconColor}; font-size: 1.2rem;"></i>
            <span class="fw-bold small">${msg}</span>
        </div>
        <button type="button" class="btn-close btn-close-white ms-3" style="font-size: 0.7rem;"></button>
    `;
    const closeBtn = div.querySelector(".btn-close");
    closeBtn.onclick = () => {
        div.style.opacity = "0";
        setTimeout(() => div.remove(), 400);
    };
    container.appendChild(div);
    setTimeout(() => {
        if (div.parentNode) {
            div.style.opacity = "0";
            setTimeout(() => div.remove(), 400);
        }
    }, 4000);
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

function validarArchivo(file) {
    if (!file) return false;
    const extensionesPermitidas = /(\.jpg|\.jpeg|\.png|\.webp|\.gif|\.avif)$/i;
    if (!extensionesPermitidas.exec(file.name)) {
        toast("Formato no soportado. Use JPG, PNG, WEBP, GIF o AVIF", "danger");
        return false;
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        toast("La imagen es demasiado pesada (Máximo 10MB)", "danger");
        return false;
    }
    return true;
}

async function crearNotificacion() {
    if (procesamientoEnCurso) return;
    const t = document.getElementById("tituloNotificacion");
    const d = document.getElementById("descNotificacion");
    const a = document.getElementById("archivoNotificacion");
    const previewImg = document.getElementById("previewNotificacionImg");

    if (!t.value.trim() || !d.value.trim()) {
        toast("El título y el mensaje son campos obligatorios", "warning");
        return;
    }

    procesamientoEnCurso = true;
    const formData = new FormData();
    formData.append("titulo", t.value);
    formData.append("descripcion", d.value);
    if (a.files[0]) {
        formData.append("archivo", a.files[0]);
    }

    try {
        const res = await fetch("/api/admin/notificaciones", {
            method: "POST",
            body: formData
        });
        const data = await res.json();
        if (data.ok) {
            toast("Notificación publicada exitosamente");
            
            t.value = "";
            d.value = "";
            a.value = "";
            
            if (previewImg) {
                previewImg.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg==";
            }
            
            cargarAlertasActivas();
        } else {
            toast(data.error || "Error al procesar la solicitud", "danger");
        }
    } catch (e) {
        toast("Error de conexión con el servidor", "danger");
    } finally {
        procesamientoEnCurso = false;
    }
}

async function cargarAlertasActivas() {
    const cont = document.getElementById("contenedorAlertas");
    if (!cont) return;
    try {
        const res = await fetch("/api/admin/notificaciones");
        const alertas = await res.json();
        cont.innerHTML = alertas.length ? "" : '<p class="text-muted small py-2 text-center">No hay alertas activas en este momento</p>';
        alertas.forEach(alerta => {
            const div = document.createElement("div");
            div.className = "alert-admin-lista mb-2 d-flex align-items-center justify-content-between";
            div.innerHTML = `
                <div class="d-flex align-items-center gap-2 overflow-hidden">
                    ${alerta.imagen_url ? `<img src="${alerta.imagen_url}" class="img-notificacion-lista">` : '<i class="bi bi-bell p-2"></i>'}
                    <div class="text-truncate">
                        <div class="fw-bold small text-truncate">${alerta.titulo}</div>
                        <div class="extra-small text-muted text-truncate">${alerta.descripcion}</div>
                    </div>
                </div>
                <button class="btn btn-sm text-danger border-0" onclick="eliminarAlerta('${alerta.id_publicidad}')">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            `;
            cont.appendChild(div);
        });
    } catch (e) {
        console.error("Error al cargar alertas:", e);
    }
}

async function eliminarAlerta(id) {
    if (!id || id === "undefined") {
        toast("ID de notificación no válido", "danger");
        return;
    }
    try {
        const res = await fetch(`/api/admin/notificaciones/${id}`, {
            method: "DELETE"
        });
        const data = await res.json();
        if (data.ok) {
            toast("Notificación eliminada correctamente", "success");
            cargarAlertasActivas();
        } else {
            toast(data.error || "No se pudo eliminar la notificación", "danger");
        }
    } catch (e) {
        toast("Error al conectar con el servidor", "danger");
    }
}

function agregarCarrusel(url = "", titulo = "", desc = "", id = "") {
    const idx = carruselIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-4";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.innerHTML = `
        <div class="drag-handle">
            <i class="bi bi-grip-vertical fs-3"></i>
        </div>
        <div class="section-content row g-3 m-0 w-100 align-items-center">
            <div class="col-md-3">
                <div class="preview-img-box mb-2">
                    <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100">
                </div>
                <input type="file" class="form-control form-control-sm mt-2" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)">
            </div>
            <div class="col-md-9">
                <div class="pe-3">
                    <label class="small fw-bold text-muted text-uppercase mb-1">Título del Carrusel</label>
                    <input type="text" class="form-control mb-2 t-tit fw-bold" placeholder="Título..." value="${titulo}" oninput="actualizarPreview()">
                    <label class="small fw-bold text-muted text-uppercase mb-1">Descripción</label>
                    <textarea class="form-control t-des" placeholder="Descripción..." rows="2" oninput="actualizarPreview()">${desc}</textarea>
                </div>
                <div class="d-flex justify-content-end mt-3">
                    <button class="btn btn-sm btn-danger px-4" onclick="borrarSec(this)">
                        <i class="bi bi-trash-fill"></i> ELIMINAR
                    </button>
                </div>
            </div>
        </div>`;
    document.getElementById("carruselContainer").appendChild(div);
    actualizarPreview();
}

function agregarSeccion(url = "", titulo = "", id = "") {
    const idx = seccionIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-3";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.innerHTML = `
        <div class="drag-handle">
            <i class="bi bi-grip-vertical fs-3"></i>
        </div>
        <div class="section-content d-flex align-items-center gap-4 w-100">
            <div class="preview-img-box shadow-sm" style="width:90px; height:90px; border-radius: 50%; min-width: 90px;">
                <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100">
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-end">
                    <div class="col-md-4">
                        <label class="small fw-bold text-muted">Imagen</label>
                        <input type="file" class="form-control form-control-sm" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)">
                    </div>
                    <div class="col-md-8">
                        <label class="small fw-bold text-muted">Texto</label>
                        <input type="text" class="form-control t-tit" placeholder="Nombre..." value="${titulo}" oninput="actualizarPreview()">
                    </div>
                </div>
            </div>
            <button class="btn btn-outline-danger border-0 flex-shrink-0" onclick="borrarSec(this)">
                <i class="bi bi-trash3-fill fs-5"></i>
            </button>
        </div>`;
    document.getElementById("seccionesContainer").appendChild(div);
    actualizarPreview();
}

function agregarCinta(url = "", titulo = "", id = "") {
    const idx = cintaIndex++;
    const div = document.createElement("div");
    div.className = "col-12 section-preview mb-2";
    div.draggable = true;
    div.dataset.index = idx;
    div.dataset.dbId = id;
    div.innerHTML = `
        <div class="drag-handle">
            <i class="bi bi-grip-vertical fs-4"></i>
        </div>
        <div class="section-content d-flex align-items-center gap-3 w-100 py-2">
            <div class="preview-img-box" style="width:50px; height:50px; border-radius: 50%; min-width: 50px;">
                <img src="${url || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJQAAACUCAYAAAB1OacDAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJBSURBVHgB7d0xbhNREIDh90YpSClpSInS06ByAnp6SByBk9ByAnp6ChonSInS06ByApSClpSClpSChv9vYScbe9be9Xp3Z76Pst6stZun8f72zZunMREp6vUf97ZOfn64fP9scfH+mYgG9fbt+6f7n8/vXrz6eC6isfrz5p8mIkW9e/dhIu6IKOp8+SyiqPP7DyIa9PHe2XfTjMREpKgzmYh9Ihp0/vEisS+isfrtHxEfXkU06uXFpyciGrW9efZ0Ihp0t3k6EQ26ubqbiCtiIjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIynL17/wEunS4O3C+hNwAAAABJRU5ErkJggg=='}" class="w-100 h-100">
            </div>
            <div class="flex-grow-1">
                <div class="row g-2 align-items-center">
                    <div class="col-md-4"><input type="file" class="form-control form-control-sm" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onchange="cambioImg(this)"></div>
                    <div class="col-md-8"><input type="text" class="form-control form-control-sm t-tit" placeholder="Texto..." value="${titulo}" oninput="actualizarPreview()"></div>
                </div>
            </div>
            <button class="btn btn-sm text-danger border-0" onclick="borrarSec(this)"><i class="bi bi-x-circle-fill fs-5"></i></button>
        </div>`;
    document.getElementById("cintaContainer").appendChild(div);
    actualizarPreview();
}

function actualizarPreview() {
    const pCar = document.querySelector("#previewCarrusel .carousel-inner");
    if (pCar) {
        pCar.innerHTML = "";
        const seccionesCar = document.querySelectorAll("#carruselContainer .section-preview");
        seccionesCar.forEach((div, i) => {
            const item = document.createElement("div");
            item.className = "carousel-item" + (i === 0 ? " active" : "");
            item.innerHTML = `
                <img src="${div.querySelector("img").src}" class="d-block w-100" style="height:450px; object-fit:contain; background:#000;">
                <div class="carousel-caption bg-dark bg-opacity-60 rounded-4 p-3 mb-3 mx-auto" style="max-width: 80%;">
                    <h5 class="mb-1 fw-bold text-uppercase">${div.querySelector(".t-tit").value}</h5>
                    <p class="small mb-0">${div.querySelector(".t-des")?.value || ""}</p>
                </div>`;
            pCar.appendChild(item);
        });
        const carruselElemento = document.querySelector("#previewCarrusel");
        if (seccionesCar.length > 0 && carruselElemento) {
            const bsCarousel = bootstrap.Carousel.getOrCreateInstance(carruselElemento);
            bsCarousel.to(0);
        }
    }
    
    const pCinta = document.getElementById("previewCintaMarquee");
    if (pCinta) {
        pCinta.innerHTML = "";
        document.querySelectorAll("#cintaContainer .section-preview").forEach(div => {
            const s = document.createElement("span");
            s.className = "mx-4 text-white d-flex align-items-center gap-2";
            s.innerHTML = `<img src="${div.querySelector("img").src}" class="img-cinta-banner"><span class="fw-bold">${div.querySelector(".t-tit").value}</span>`;
            pCinta.appendChild(s);
        });
    }

    const pSec = document.getElementById("previewSecciones");
    if (pSec) {
        pSec.innerHTML = "";
        document.querySelectorAll("#seccionesContainer .section-preview").forEach(div => {
            const d = document.createElement("div");
            d.className = "col-4 col-md-2 text-center mb-4";
            d.innerHTML = `
                <div style="width:65px; height:65px; margin: 0 auto; background:#f8f9fa;" class="rounded-circle overflow-hidden shadow-sm mb-2 border">
                    <img src="${div.querySelector("img").src}" class="w-100 h-100" style="object-fit:contain;">
                </div>
                <div class="small fw-bold text-dark text-truncate px-1">${div.querySelector(".t-tit").value}</div>`;
            pSec.appendChild(d);
        });
    }
}

async function guardarMarketing() {
    if (procesamientoEnCurso) return;
    
    const btn = document.getElementById("btnGuardarMarketing");
    const originalText = btn.innerHTML;
    
    procesamientoEnCurso = true;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> GUARDANDO...';

    const formData = new FormData();

    const extraerSeccion = (containerId, metaKey, filePrefix) => {
        const metadata = [];
        const items = document.querySelectorAll(`#${containerId} .section-preview`);
        
        items.forEach((div, index) => {
            const fileInput = div.querySelector('input[type="file"]');
            const file = fileInput.files[0];
            
            if (file) {
                formData.append(`${filePrefix}_${index}`, file);
            }

            metadata.push({
                index: index,
                titulo: div.querySelector(".t-tit")?.value || "",
                descripcion: div.querySelector(".t-des")?.value || "",
                url_actual: div.querySelector("img").src,
                cambio_img: div.dataset.cambioImagen === "true",
                db_id: div.dataset.dbId || null
            });
        });
        formData.append(metaKey, JSON.stringify(metadata));
    };

    extraerSeccion("carruselContainer", "metadata_carrusel", "file_carrusel");
    extraerSeccion("seccionesContainer", "metadata_secciones", "file_secciones");
    extraerSeccion("cintaContainer", "metadata_cinta", "file_cinta");

    try {
        const response = await fetch("/publicidad_page", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        if (data.ok) {
            toast("Publicidad actualizada correctamente");
            setTimeout(() => location.reload(), 1000);
        } else {
            toast(data.error || "Error al guardar", "danger");
        }
    } catch (error) {
        toast("Error de conexión con el servidor", "danger");
    } finally {
        procesamientoEnCurso = false;
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function initDrag(containerId) {
    const container = document.getElementById(containerId);
    if(!container) return;
    container.addEventListener('dragstart', e => { 
        if(e.target.classList.contains('section-preview')) e.target.classList.add('dragging'); 
    });
    container.addEventListener('dragend', e => { 
        if(e.target.classList.contains('section-preview')) { 
            e.target.classList.remove('dragging'); 
            actualizarPreview(); 
        } 
    });
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const dragging = container.querySelector('.dragging');
        const afterElement = [...container.querySelectorAll('.section-preview:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        if (dragging && afterElement == null) container.appendChild(dragging); 
        else if (dragging) container.insertBefore(dragging, afterElement);
    });
}

function cambioImg(input) {
    const file = input.files[0];
    if (!validarArchivo(file)) { input.value = ""; return; }
    const container = input.closest(".section-preview");
    const imgElement = container.querySelector("img");
    const r = new FileReader();
    r.onload = e => {
        imgElement.src = e.target.result;
        container.dataset.cambioImagen = "true";
        actualizarPreview();
    };
    r.readAsDataURL(file);
}

async function borrarSec(btn) {
    const container = btn.closest(".section-preview");
    const dbId = container.dataset.dbId;
    if (!dbId) {
        container.remove();
        actualizarPreview();
        return;
    }
    try {
        const r = await fetch(`/api/admin/publicidad/delete/${dbId}`, { method: "DELETE" });
        if (r.status === 401 || r.status === 403) { location.reload(); return; }
        const d = await r.json();
        if (d.ok) {
            container.remove();
            actualizarPreview();
            toast("Eliminado correctamente", "info");
        }
    } catch (e) {
        toast("Error de conexión", "danger");
    }
}

function cargarPublicidadActiva() {
    fetch("/api/publicidad/activa")
    .then(r => {
        if (r.status === 401 || r.status === 403) { location.reload(); return; }
        return r.json();
    })
    .then(dataList => {
        if (!Array.isArray(dataList)) return;
        document.getElementById("carruselContainer").innerHTML = "";
        document.getElementById("seccionesContainer").innerHTML = "";
        document.getElementById("cintaContainer").innerHTML = "";
        dataList.forEach(item => {
            if (item.tipo === 'carrusel') agregarCarrusel(item.imagen_url, item.titulo, item.descripcion, item.id_publicidad);
            if (item.tipo === 'seccion') agregarSeccion(item.imagen_url, item.titulo, item.id_publicidad);
            if (item.tipo === 'cinta') agregarCinta(item.imagen_url, item.titulo, item.id_publicidad);
        });
        actualizarPreview();
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const tieneAcceso = await verificarAccesoAdmin();
    
    if (!tieneAcceso) return;

    const esAdmin = document.getElementById("carruselContainer") !== null;
    if (esAdmin) {
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

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-publicidad.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}