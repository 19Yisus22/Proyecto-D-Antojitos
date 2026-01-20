const form = document.getElementById("loginForm") || document.getElementById("registerForm");
const toastContainer = document.getElementById("toastContainer");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

function showMessage(msg, isSuccess = false) {
    const toastEl = document.createElement('div');
    toastEl.className = 'custom-toast';
    toastEl.style.position = 'fixed';
    toastEl.style.bottom = '20px';
    toastEl.style.left = '20px';
    toastEl.style.zIndex = '9999';
    toastEl.innerHTML = `
        <div class="d-flex align-items-center">
            <i class="bi ${isSuccess ? 'bi-check-circle text-success' : 'bi-x-circle text-danger'} me-3 fs-5"></i>
            <span>${msg}</span>
        </div>
        <i class="bi bi-x-lg ms-3 btn-close-toast" style="cursor:pointer; font-size: 0.7rem;"></i>
    `;
    toastContainer.appendChild(toastEl);
    
    const remove = () => {
        toastEl.style.opacity = '0';
        setTimeout(() => toastEl.remove(), 400);
    };
    
    toastEl.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 3500);
}

function limpiarEstadoAuth() {
    sessionStorage.clear();
    localStorage.clear();
    if (window.google) {
        google.accounts.id.disableAutoSelect();
    }
}

async function manejarRespuestaGoogle(response) {
    try {
        const res = await fetch("/registro-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();
        if (res.ok && data.ok) {
            if (data.user) {
                sessionStorage.setItem("user", JSON.stringify(data.user));
            }
            
            showMessage("Bienvenido Cliente", true);
            
            setTimeout(() => {
                window.location.href = data.redireccion || "/inicio";
            }, 1500);
        } else {
            showMessage(data.error || "Error de validación", false);
        }
    } catch (err) {
        showMessage("Error de conexión", false);
    }
}

async function inicializarGoogle() {
    try {
        const res = await fetch("/obtener-cliente-id");
        const data = await res.json();
        if (data.client_id) {
            google.accounts.id.initialize({
                client_id: data.client_id,
                callback: manejarRespuestaGoogle,
                ux_mode: 'popup',
                use_fedcm_for_prompt: false,
                auto_select: false
            });
            google.accounts.id.renderButton(
                document.getElementById("buttonDiv"),
                { theme: "outline", size: "large", width: "350", shape: "pill" }
            );
        }
    } catch (err) {
        console.error(err);
    }
}

window.addEventListener('load', () => {
    if (window.location.search.includes('logout=true')) {
        limpiarEstadoAuth();
    }
    inicializarGoogle();
});

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const isLogin = form.id === "loginForm";
        const endpoint = isLogin ? "/login" : "/registro";
        
        let datos = {};
        if (isLogin) {
            datos = {
                correo: document.getElementById("correo").value.trim().toLowerCase(),
                contrasena: document.getElementById("contrasena").value.trim()
            };
        } else {
            datos = {
                cedula: document.getElementById("cedula").value.trim(),
                nombre: document.getElementById("nombre").value.trim(),
                apellido: document.getElementById("apellido").value.trim(),
                correo: document.getElementById("correo").value.trim().toLowerCase(),
                telefono: document.getElementById("telefono").value.trim(),
                contrasena: document.getElementById("contrasena").value
            };
        }

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datos)
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                if (isLogin) {
                    sessionStorage.setItem("user", JSON.stringify(data.user));
                    showMessage(data.user.roles?.nombre_role === "admin" ? "Bienvenido Administrador" : "Bienvenido Cliente", true);
                } else {
                    showMessage("Registro exitoso", true);
                }
                setTimeout(() => {
                    window.location.href = isLogin ? (data.redirect || "/inicio") : "/login";
                }, 1500);
            } else {
                showMessage(data.error || "Error en la operación", false);
            }
        } catch (err) {
            showMessage("Error al conectar con el servidor", false);
        }
    });
}

if (linkRegistro) {
    linkRegistro.addEventListener("click", (e) => {
        e.preventDefault();
        sessionStorage.removeItem("user");
        window.location.href = "/registro";
    });
}

if (linkInicio) {
    linkInicio.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "/inicio";
    });
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/js/workers/service-worker-registro.js')
        .then(reg => {
            console.log('SW registrado correctamente');
        })
        .catch(error => {
            console.error('Error al registrar el SW:', error);
        });
    });
}