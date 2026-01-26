const catalogoContainer = document.getElementById("catalogoProductos");
const btnFiltrar = document.getElementById("btnFiltrar");
const searchInput = document.getElementById("searchInput");
const toastContainer = document.getElementById("toastContainer");

let postres = [];
let indexActual = null;
let isUpdating = false;

const btnAgregarPostre = document.getElementById("btnAgregarPostre");
const btnCancelar = document.getElementById("btnCancelar");
const formAgregarPostre = document.getElementById("formAgregarPostre");
const agregarPostreForm = document.getElementById("agregarPostreForm");
const listaPostresDisponibles = document.getElementById("listaPostresDisponibles");
const listaPostresAgotados = document.getElementById("listaPostresAgotados");
const avisoAgotados = document.getElementById("avisoAgotados");
const modalElement = document.getElementById("modalPostre");
const modal = new bootstrap.Modal(modalElement);
const btnSubmitForm = document.getElementById("btnSubmitForm");

function ajustarAtributosPrecio() {
    const precioInput = document.getElementById("precioPostre");
    if (precioInput) {
        precioInput.setAttribute("step", "any");
    }
}

function showMessage(msg, isError = false) {
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isError ? 'bi-x-circle text-danger' : 'bi-check-circle text-success'} me-3 fs-5"></i>
            <span>${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
    `;
    toastContainer.appendChild(toast);
    
    const remove = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-20px)';
        setTimeout(() => toast.remove(), 400);
    };
    
    toast.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

btnAgregarPostre.addEventListener("click", () => {
    indexActual = null;
    agregarPostreForm.reset();
    btnSubmitForm.innerHTML = '<i class="bi bi-check-lg me-2"></i>Subir Postre';
    formAgregarPostre.classList.remove("d-none");
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

btnCancelar.addEventListener("click", () => {
    formAgregarPostre.classList.add("d-none");
    agregarPostreForm.reset();
    indexActual = null;
});

async function cargarPostres(silent = false) {
    if (isUpdating && !silent) return;
    isUpdating = true;

    try {
        const res = await fetch("/gestionar_productos");
        
        if (res.status === 401 || res.status === 403) {
            if (!silent) showMessage("Sesión expirada", true);
            return;
        }

        const nuevosPostres = await res.json();
        
        if (JSON.stringify(nuevosPostres) !== JSON.stringify(postres)) {
            postres = nuevosPostres;
            localStorage.setItem('postresCache', JSON.stringify(postres));
            renderPostres();
        }
    } catch (error) {
        console.error("Error en actualización:", error);
    } finally {
        isUpdating = false;
    }
}

function renderPostres() {
    listaPostresDisponibles.innerHTML = "";
    listaPostresAgotados.innerHTML = "";
    let hayAgotados = false;

    postres.forEach((p, index) => {
        const card = document.createElement("div");
        card.className = "col-4 mb-3 d-flex align-items-stretch";
        const imgUrl = p.imagen_url || "/static/uploads/default.png";
        
        card.innerHTML = `
        <div class="card w-100 cursor-pointer ${p.stock <= 0 ? 'gris' : ''}" data-id="${p.id_producto}">
            <img src="${imgUrl}" class="card-img-top postre-img" alt="${p.nombre}">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <h5 class="card-title mb-0 text-truncate" style="max-width: 150px;" title="${p.nombre}">${p.nombre}</h5>
                    <span class="badge ${p.stock <= 5 ? 'bg-danger' : 'bg-info'} text-dark">${p.stock}</span>
                </div>
                <p class="card-text fw-bold">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
            </div>
        </div>`;

        card.querySelector(".card").onclick = () => abrirModalPostre(index);

        if (p.stock > 0) {
            listaPostresDisponibles.appendChild(card);
        } else {
            listaPostresAgotados.appendChild(card);
            hayAgotados = true;
        }
    });
    avisoAgotados.classList.toggle("d-none", !hayAgotados);
}

function abrirModalPostre(index) {
    indexActual = index;
    const p = postres[index];
    document.getElementById("modalNombre").textContent = p.nombre;
    document.getElementById("modalFoto").src = p.imagen_url || "/static/uploads/default.png";
    document.getElementById("modalDescripcion").textContent = p.descripcion;
    document.getElementById("modalPrecio").textContent = Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });
    document.getElementById("modalStock").textContent = p.stock;
    modal.show();
}

document.getElementById("btnEliminar").onclick = async () => {
    if (indexActual === null) return;
    const p = postres[indexActual];
    
    try {
        const res = await fetch(`/eliminar_producto/${p.id_producto}`, { 
            method: "DELETE"
        });
        
        if (res.ok) {
            showMessage("Producto eliminado");
            modal.hide();
            indexActual = null;
            await cargarPostres();
        } else {
            const err = await res.json();
            showMessage(err.error || "Error al eliminar", true);
        }
    } catch (e) {
        showMessage("Error de conexión", true);
    }
};

document.getElementById("btnEditar").onclick = () => {
    if (indexActual === null) return;
    const p = postres[indexActual];
    
    document.getElementById("nombrePostre").value = p.nombre;
    document.getElementById("precioPostre").value = p.precio;
    document.getElementById("descripcionPostre").value = p.descripcion;
    document.getElementById("stockPostre").value = p.stock;
    
    btnSubmitForm.innerHTML = '<i class="bi bi-pencil-square me-2"></i>Actualizar Postre';
    formAgregarPostre.classList.remove("d-none");
    modal.hide();
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

agregarPostreForm.onsubmit = async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById("fotoPostre");
    const file = fileInput.files[0];
    const formData = new FormData();
    
    formData.append("nombre", document.getElementById("nombrePostre").value);
    formData.append("precio", document.getElementById("precioPostre").value);
    formData.append("descripcion", document.getElementById("descripcionPostre").value);
    formData.append("stock", document.getElementById("stockPostre").value);

    if (file) {
        const reader = new FileReader();
        reader.onloadend = async () => {
            formData.append("foto_base64", reader.result.split(",")[1]);
            formData.append("foto_name", file.name);
            await enviarFormulario(formData);
        };
        reader.readAsDataURL(file);
    } else {
        await enviarFormulario(formData);
    }
};

async function enviarFormulario(formData) {
    const esEdicion = indexActual !== null;
    const metodo = esEdicion ? "PUT" : "POST";
    const url = esEdicion ? `/actualizar_producto/${postres[indexActual].id_producto}` : "/gestionar_productos";
    
    try {
        const res = await fetch(url, { method: metodo, body: formData });
        
        if (res.ok) {
            formAgregarPostre.classList.add("d-none");
            agregarPostreForm.reset();
            indexActual = null;
            await cargarPostres();
            showMessage(esEdicion ? "Actualizado correctamente" : "Agregado correctamente");
        } else {
            showMessage("Error al guardar datos", true);
        }
    } catch (e) {
        showMessage("Error de red", true);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    ajustarAtributosPrecio();
    
    const cached = localStorage.getItem('postresCache');
    if (cached) {
        postres = JSON.parse(cached);
        renderPostres();
    }
    
    cargarPostres();
    
    setInterval(() => {
        cargarPostres(true);
    }, 10000);
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-catalogo.js')
        .then(() => { console.log('SW OK'); })
        .catch(() => { console.log('SW Error'); });
    });
}