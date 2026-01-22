let postres = [];
let indexActual = null;
const btnAgregarPostre = document.getElementById("btnAgregarPostre");
const btnCancelar = document.getElementById("btnCancelar");
const formAgregarPostre = document.getElementById("formAgregarPostre");
const agregarPostreForm = document.getElementById("agregarPostreForm");
const listaPostresDisponibles = document.getElementById("listaPostresDisponibles");
const listaPostresAgotados = document.getElementById("listaPostresAgotados");
const avisoAgotados = document.getElementById("avisoAgotados");
const toastContainer = document.getElementById("toastContainer");
const modal = new bootstrap.Modal(document.getElementById("modalPostre"));

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

btnAgregarPostre.addEventListener("click", () => formAgregarPostre.classList.remove("d-none"));
btnCancelar.addEventListener("click", () => formAgregarPostre.classList.add("d-none"));

async function cargarPostres() {
    const cached = localStorage.getItem('postresCache');
    if (cached) {
        postres = JSON.parse(cached);
        renderPostres();
    }
    const res = await fetch("/gestionar_productos");
    if (res.status === 401 || res.status === 403) {
        showMessage("Inicie Sesión para gestionar", true);
        document.querySelectorAll("button, input, textarea").forEach(el => el.disabled = true);
        return;
    }
    postres = await res.json();
    localStorage.setItem('postresCache', JSON.stringify(postres));
    renderPostres();
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
        <div class="card w-100 cursor-pointer ${p.stock <= 0 ? 'gris' : ''}">
            <img src="${imgUrl}" class="card-img-top postre-img">
            <div class="card-body">
                <div class="d-flex justify-content-between align-items-start mb-1">
                    <h5 class="card-title mb-0" title="${p.nombre}">${p.nombre}</h5>
                    <span class="badge bg-info text-dark">${p.stock}</span>
                </div>
                <p class="card-text fw-bold">${Number(p.precio).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 })}</p>
            </div>
        </div>`;
        card.querySelector(".card").addEventListener("click", () => abrirModalPostre(index));
        if (p.stock > 0) listaPostresDisponibles.appendChild(card);
        else { 
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

document.getElementById("btnEliminar").addEventListener("click", async () => {
    if (indexActual === null) return;
    const p = postres[indexActual];
    const res = await fetch(`/eliminar_producto/${p.id_producto}`, { method: "DELETE" });
    if (res.ok) showMessage("Producto Eliminado");
    modal.hide();
    indexActual = null;
    await cargarPostres();
});

document.getElementById("btnEditar").addEventListener("click", () => {
    if (indexActual === null) return;
    const p = postres[indexActual];
    formAgregarPostre.classList.remove("d-none");
    document.getElementById("nombrePostre").value = p.nombre;
    document.getElementById("precioPostre").value = p.precio;
    document.getElementById("descripcionPostre").value = p.descripcion;
    document.getElementById("stockPostre").value = p.stock;
    document.getElementById("fotoPostre").value = "";
    modal.hide();
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

agregarPostreForm.addEventListener("submit", async (e) => {
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
    } else await enviarFormulario(formData);
});

async function enviarFormulario(formData) {
    const metodo = indexActual !== null ? "PUT" : "POST";
    const url = indexActual !== null ? `/actualizar_producto/${postres[indexActual].id_producto}` : "/gestionar_productos";
    const res = await fetch(url, { method: metodo, body: formData });
    if (res.status === 401 || res.status === 403) {
        showMessage("No tienes permisos para realizar esta acción", true);
        return;
    }
    if (res.ok) {
        formAgregarPostre.classList.add("d-none");
        agregarPostreForm.reset();
        indexActual = null;
        await cargarPostres();
        showMessage("Postre Actualizado");
    } else showMessage("Error en la operación", true);
}

cargarPostres();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-gestion_productos.js')
        .then(reg => {
            console.log('SW registrado correctamente');
        })
        .catch(error => {
            console.error('Error al registrar el SW:', error);
        });
    });
}