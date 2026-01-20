const form = document.getElementById("loginForm") || document.getElementById("registerForm");
const toastContainer = document.getElementById("toastContainer");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

function showMessage(msg, isSuccess = false) {
    const toastEl = document.createElement('div');
    toastEl.className = 'toast align-items-center text-bg-light border-0';
    toastEl.setAttribute('role', 'alert');
    toastEl.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${isSuccess ? '✅' : '❌'} ${msg}</div>
            <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
    `;
    toastContainer.appendChild(toastEl);
    new bootstrap.Toast(toastEl, { delay: 3000 }).show();
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
            showMessage(data.mensaje || "Bienvenido", true);
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

if ('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/service-worker-login.js').catch(console.error);});}