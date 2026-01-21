let carruselIndex = 0, seccionIndex = 0;
let carruselUrls = {}, seccionesUrls = {};
let procesamientoEnCurso = false;

function toast(msg, tipo = "success") {
    const div = document.createElement("div");
    div.className = `toast align-items-center text-bg-${tipo} border-0 show`;
    div.innerHTML = `<div class="d-flex"><div class="toast-body">${msg}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
    document.getElementById("toastContainer").appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

function showConfirmToast(msg, callback) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-bg-warning border-0 show';
    toast.style.minWidth = "300px";
    toast.innerHTML = `
        <div class="d-flex flex-column p-2">
            <div class="d-flex align-items-center mb-2">
                <i class="bi bi-exclamation-triangle me-2"></i>
                <span class="fw-bold">${msg}</span>
            </div>
            <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-sm btn-outline-secondary btn-cancel">Cancelar</button>
                <button class="btn btn-sm btn-danger btn-confirm">Confirmar</button>
            </div>
        </div>
    `;
    container.appendChild(toast);

    const remove = () => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector('.btn-cancel').onclick = remove;
    toast.querySelector('.btn-confirm').onclick = () => {
        callback();
        remove();
    };
}

document.getElementById("archivoNotificacion").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = ev => {
        document.getElementById("previewNotificacionImg").src = ev.target.result;
        document.getElementById("previewNotificacion").style.display = "block";
    };
    r.readAsDataURL(file);
});

async function crearNotificacion() {
    if (procesamientoEnCurso) {
        toast("Por favor espere, procesando solicitud anterior...", "warning");
        return;
    }

    const fileInput = document.getElementById("archivoNotificacion");
    const titulo = document.getElementById("tituloNotificacion").value.trim();
    const desc = document.getElementById("descNotificacion").value.trim();
    if (!titulo || !desc) { toast("Complete los campos", "warning"); return; }
    
    procesamientoEnCurso = true;
    const btn = event.target;
    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Procesando...";

    const formData = new FormData();
    formData.append("titulo", titulo);
    formData.append("descripcion", desc);
    if (fileInput.files[0]) formData.append("archivo", fileInput.files[0]);
    
    fetch("/api/admin/notificaciones", { method: "POST", body: formData }).then(r => r.json()).then(d => {
        toast(d.msg);
        fileInput.value = "";
        document.getElementById("previewNotificacion").style.display = "none";
        document.getElementById("tituloNotificacion").value = "";
        document.getElementById("descNotificacion").value = "";
        cargarAlertas();
    }).finally(() => {
        procesamientoEnCurso = false;
        btn.disabled = false;
        btn.innerText = textoOriginal;
    });
}

function cargarAlertas() {
    fetch("/api/admin/notificaciones").then(r => r.json()).then(data => {
        const cont = document.getElementById("contenedorAlertas");
        cont.innerHTML = "";
        data.forEach(a => {
            const div = document.createElement("div");
            div.className = "notificacion-item";
            div.innerHTML = `
      <img src="${a.imagen_url || ''}" class="notificacion-img-actual" style="width:80px; height:80px; object-fit:cover; border-radius:5px;">
      <div class="flex-grow-1 notificacion-vista"><strong>${a.titulo}</strong><br><span>${a.descripcion}</span></div>
      <div class="flex-grow-1 notificacion-editar" style="display:none;">
        <input type="text" class="form-control mb-1 edit-titulo" value="${a.titulo}">
        <input type="text" class="form-control mb-1 edit-desc" value="${a.descripcion}">
        <input type="file" class="form-control edit-img" onchange="previewImagenNotificacion(this)">
      </div>
      <div class="d-flex flex-column gap-2">
        <button class="btn btn-sm btn-warning btn-editar" onclick="toggleEditarNotificacion(this)">Editar</button>
        <button class="btn btn-sm btn-success btn-guardar" style="display:none;" onclick="guardarEdicionNotificacion(this,'${a.id_notificacion}')">OK</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarNotificacion('${a.id_notificacion}',this.closest('.notificacion-item'))">X</button>
      </div>`;
            cont.appendChild(div);
        });
    });
}

function previewImagenNotificacion(input) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = e => {
            input.closest('.notificacion-item').querySelector('.notificacion-img-actual').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

function toggleEditarNotificacion(btn) {
    const item = btn.closest('.notificacion-item');
    item.querySelector('.notificacion-vista').style.display = 'none';
    item.querySelector('.notificacion-editar').style.display = 'block';
    btn.style.display = 'none';
    item.querySelector('.btn-guardar').style.display = 'block';
}

async function guardarEdicionNotificacion(btn, id) {
    if (procesamientoEnCurso) {
        toast("Por favor espere, procesando solicitud anterior...", "warning");
        return;
    }

    procesamientoEnCurso = true;
    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "...";

    const item = btn.closest('.notificacion-item');
    const formData = new FormData();
    formData.append("titulo", item.querySelector('.edit-titulo').value);
    formData.append("descripcion", item.querySelector('.edit-desc').value);
    const file = item.querySelector('.edit-img').files[0];
    if (file) formData.append("archivo", file);
    
    fetch(`/api/admin/notificaciones/${id}`, { method: "PUT", body: formData })
    .then(r => r.json())
    .then(d => {
        if(d.ok) {
            toast("Notificación actualizada");
            cargarAlertas();
        } else {
            toast(d.error || "Error al actualizar", "danger");
        }
    }).finally(() => {
        procesamientoEnCurso = false;
        btn.disabled = false;
        btn.innerText = textoOriginal;
    });
}

function eliminarNotificacion(id, el) {
    if (procesamientoEnCurso) {
        toast("Por favor espere, procesando solicitud anterior...", "warning");
        return;
    }

    showConfirmToast("¿Eliminar esta notificación definitivamente?", () => {
        procesamientoEnCurso = true;
        fetch(`/api/admin/notificaciones/${id}`, { method: "DELETE" })
        .then(r => r.json())
        .then(d => {
            if(d.ok) {
                toast("Notificación eliminada");
                el.remove();
            }
        }).finally(() => {
            procesamientoEnCurso = false;
        });
    });
}

function agregarCarrusel(url = "", titulo = "", desc = "") {
    const idx = carruselIndex++;
    if (url) carruselUrls[idx] = url;
    const div = document.createElement("div");
    div.className = "section-preview";
    div.dataset.index = idx;
    div.innerHTML = `<div class="d-flex gap-3">
    <div><div class="preview-img-box"><img src="${url || ''}"></div><input type="file" class="form-control form-control-sm" onchange="cambioImg(this,'carrusel',${idx})"></div>
    <div class="flex-grow-1">
      <input type="text" class="form-control mb-2 t-tit" placeholder="Título Publicidad" value="${titulo}" oninput="actualizarPreview()">
      <textarea class="form-control mb-2 t-des" placeholder="Descripción Publicidad" oninput="actualizarPreview()">${desc}</textarea>
      <button class="btn btn-danger btn-sm" onclick="borrarSec(this,'carrusel',${idx})">Eliminar</button>
    </div>
  </div>`;
    document.getElementById("carruselContainer").appendChild(div);
    actualizarPreview();
}

function agregarSeccion(url = "", titulo = "", desc = "") {
    const idx = seccionIndex++;
    if (url) seccionesUrls[idx] = url;
    const div = document.createElement("div");
    div.className = "section-preview";
    div.dataset.index = idx;
    div.innerHTML = `<div class="d-flex gap-3">
    <div><div class="preview-img-box"><img src="${url || ''}"></div><input type="file" class="form-control form-control-sm" onchange="cambioImg(this,'seccion',${idx})"></div>
    <div class="flex-grow-1">
      <input type="text" class="form-control mb-2 t-tit" placeholder="Título Publicidad" value="${titulo}" oninput="actualizarPreview()">
      <textarea class="form-control mb-2 t-des" placeholder="Descripción Publicidad" oninput="actualizarPreview()">${desc}</textarea>
      <button class="btn btn-danger btn-sm" onclick="borrarSec(this,'seccion',${idx})">Eliminar</button>
    </div>
  </div>`;
    document.getElementById("seccionesContainer").appendChild(div);
    actualizarPreview();
}

function cambioImg(input, tipo, idx) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        input.parentElement.querySelector("img").src = e.target.result;
        actualizarPreview();
    };
    reader.readAsDataURL(file);
}

function borrarSec(btn, tipo, idx) {
    btn.closest(".section-preview").remove();
    actualizarPreview();
}

function actualizarPreview() {
    const pCar = document.querySelector("#previewCarrusel .carousel-inner");
    if (!pCar) return;
    pCar.innerHTML = "";
    const carruselItems = document.querySelectorAll("#carruselContainer .section-preview");

    carruselItems.forEach((div, i) => {
        const img = div.querySelector("img").src;
        const item = document.createElement("div");
        item.className = "carousel-item" + (i === 0 ? " active" : "");
        item.innerHTML = `<img src="${img}" class="d-block w-100" style="height:350px; object-fit:contain; background-color:#f8f9fa;"><div class="carousel-caption-below" style="background:rgba(0,0,0,0.7); color:white; padding:10px; border-radius:8px; margin-top:5px;"><strong>${div.querySelector(".t-tit").value}</strong><br>${div.querySelector(".t-des").value}</div>`;
        pCar.appendChild(item);
    });

    const pContainer = document.getElementById("previewCarrusel");
    pContainer.querySelectorAll('.carousel-control-prev, .carousel-control-next').forEach(c => c.remove());

    if (carruselItems.length > 1) {
        pContainer.insertAdjacentHTML('beforeend', `
      <button class="carousel-control-prev" type="button" data-bs-target="#previewCarrusel" data-bs-slide="prev">
        <span class="carousel-control-prev-icon" aria-hidden="true" style="filter: invert(1);"></span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#previewCarrusel" data-bs-slide="next">
        <span class="carousel-control-next-icon" aria-hidden="true" style="filter: invert(1);"></span>
      </button>
    `);
    }

    const pSec = document.getElementById("previewSecciones");
    if (pSec) {
        pSec.innerHTML = "";
        document.querySelectorAll("#seccionesContainer .section-preview").forEach(div => {
            const d = document.createElement("div");
            d.className = "text-center p-2 border m-1";
            d.style.width = "200px";
            d.innerHTML = `<img src="${div.querySelector("img").src}" class="img-fluid rounded mb-2" style="height:150px; object-fit:cover;"><div><strong>${div.querySelector(".t-tit").value}</strong><br><small>${div.querySelector(".t-des").value}</small></div>`;
            pSec.appendChild(d);
        });
    }
    
    const pInfo = document.getElementById("previewInfo");
    if (pInfo) pInfo.innerText = document.getElementById("infoInicio").value;
}

async function guardarMarketing() {
    if (procesamientoEnCurso) {
        toast("Por favor espere, procesando solicitud anterior...", "warning");
        return;
    }

    procesamientoEnCurso = true;
    const btn = document.getElementById("btnGuardarMarketing");
    btn.disabled = true;
    btn.innerText = "Procesando...";
    
    const formData = new FormData();
    formData.append("subtitulo", document.getElementById("infoInicio").value);

    const metaC = [], metaS = [];

    document.querySelectorAll("#carruselContainer .section-preview").forEach(div => {
        const fileInput = div.querySelector('input[type="file"]');
        const idx = div.dataset.index;
        const hasNew = fileInput.files.length > 0;
        if (hasNew) formData.append("imagenes_carrusel", fileInput.files[0]);
        metaC.push({
            titulo: div.querySelector(".t-tit").value,
            descripcion: div.querySelector(".t-des").value,
            url: carruselUrls[idx] || "",
            has_new: hasNew
        });
    });

    document.querySelectorAll("#seccionesContainer .section-preview").forEach(div => {
        const fileInput = div.querySelector('input[type="file"]');
        const idx = div.dataset.index;
        const hasNew = fileInput.files.length > 0;
        if (hasNew) formData.append("imagenes_secciones", fileInput.files[0]);
        metaS.push({
            titulo: div.querySelector(".t-tit").value,
            descripcion: div.querySelector(".t-des").value,
            url: seccionesUrls[idx] || "",
            has_new: hasNew
        });
    });

    formData.append("metadata_carrusel", JSON.stringify(metaC));
    formData.append("metadata_secciones", JSON.stringify(metaS));

    try {
        const response = await fetch("/publicidad_page", { method: "POST", body: formData });
        const result = await response.json();
        if (result.ok) {
            toast(result.msg, "success");
            setTimeout(() => location.reload(), 1500);
        }
    } catch (error) {
        toast("Error al guardar", "danger");
    } finally {
        procesamientoEnCurso = false;
        btn.disabled = false;
        btn.innerText = "Guardar y Publicar";
    }
}

function cargarPublicidadActiva() {
    fetch("/api/publicidad/activa").then(r => r.json()).then(data => {
        if (!data || Object.keys(data).length === 0) return;
        document.getElementById("infoInicio").value = data.subtitulo || "";
        if (data.metadata_carrusel) {
            data.metadata_carrusel.forEach(c => agregarCarrusel(c.url, c.titulo, c.descripcion));
        }
        if (data.metadata_secciones) {
            data.metadata_secciones.forEach(s => agregarSeccion(s.url, s.titulo, s.descripcion));
        }
        actualizarPreview();
    });
}

document.addEventListener("DOMContentLoaded", () => {
    cargarAlertas();
    cargarPublicidadActiva();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-publicidad.js')
        .then(reg => {
            console.log('SW registrado correctamente');
        })
        .catch(error => {
            console.error('Error al registrar el SW:', error);
        });
    });
}