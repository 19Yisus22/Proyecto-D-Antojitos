const form = document.getElementById("loginForm");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("contrasena");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");
        this.classList.toggle("bi-eye");
        this.classList.toggle("bi-eye-slash");
    });
}

function playNotificationSound() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.03, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.005, audioCtx.currentTime + 0.2);
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) { }
}

function setLoading(btnId, isLoading, originalText) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? 
        `<span class="spinner-border spinner-border-sm me-2"></span>Procesando...` : 
        originalText;
}

function mostrarToastPublicidad(imagen, titulo, descripcion, isError = false) {
    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        cont.className = "position-fixed top-0 start-0 p-3";
        cont.style.zIndex = "1080";
        document.body.appendChild(cont);
    }
    playNotificationSound();
    const t = document.createElement("div");
    t.className = "custom-toast fade-in bg-white shadow p-2 mb-2";
    t.style.borderRadius = "10px";
    t.style.minWidth = "280px";
    
    const textColor = isError ? '#dc3545' : '#d6336c';
    const iconClass = isError ? 'bi-x-circle-fill' : 'bi-megaphone-fill';
    
    t.innerHTML = `
        <div class="d-flex align-items-center" style="width: 100%;">
            <img src="${imagen || '/static/uploads/logo.ico'}" style="width:45px;height:45px;object-fit:cover;border-radius:8px;" class="me-3 shadow-sm">
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-0">
                    <i class="bi ${iconClass} me-2" style="color: ${textColor};"></i>
                    <strong style="color: #333; font-size: 0.85rem;" class="mb-0">${titulo}</strong>
                </div>
                <small class="text-muted" style="font-size: 0.72rem; display: block; line-height: 1.2;">${descripcion}</small>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.7rem; color: #999;"></i>
        </div>`;
    
    cont.appendChild(t);
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-20px)';
        setTimeout(() => t.remove(), 400);
    };
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 5500);
}

function limpiarEstadoAuth() {
    sessionStorage.clear();
    localStorage.clear();
    if (window.google) {
        google.accounts.id.disableAutoSelect();
    }
}

async function manejarRespuestaGoogle(response) {
    const buttonDiv = document.getElementById("buttonDiv");
    if (buttonDiv) {
        buttonDiv.style.pointerEvents = "none";
        buttonDiv.style.opacity = "0.6";
    }

    try {
        const res = await fetch("/registro-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: response.credential })
        });
        const data = await res.json();
        
        if (res.ok && data.ok) {
            sessionStorage.setItem("user", JSON.stringify(data.user));
            const rol = data.user.roles?.nombre_role || data.user.rol || "cliente";
            const saludo = rol === "admin" ? "Bienvenido Administrador" : "Bienvenido Cliente";
            mostrarToastPublicidad('/static/uploads/logo.png', "Sesión Iniciada", saludo, false);
            setTimeout(() => window.location.href = data.redireccion || "/inicio", 1600);
        } else {
            throw new Error(data.error || "Fallo en la autenticación");
        }
    } catch (err) {
        if (buttonDiv) {
            buttonDiv.style.pointerEvents = "auto";
            buttonDiv.style.opacity = "1";
        }
        mostrarToastPublicidad(null, "Error de Acceso", err.message, true);
    }
}

async function inicializarGoogle() {
    try {
        const res = await fetch("/obtener-cliente-id");
        const data = await res.json();
        if (data.client_id && window.google) {
            google.accounts.id.initialize({
                client_id: data.client_id,
                callback: manejarRespuestaGoogle,
                ux_mode: 'popup',
                auto_select: false,
                itp_support: true
            });
            google.accounts.id.renderButton(
                document.getElementById("buttonDiv"),
                { theme: "outline", size: "large", width: "350", shape: "pill" }
            );
        }
    } catch (err) { }
}

window.addEventListener('load', () => {
    if (window.location.search.includes('logout=true')) {
        limpiarEstadoAuth();
    }
    inicializarGoogle();
});

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById("btnSubmitLogin");
    const originalText = btnSubmit.innerHTML;
    const correo = document.getElementById("correo").value.trim().toLowerCase();
    const contrasena = document.getElementById("contrasena").value.trim();
    
    if (!correo || !contrasena) {
        mostrarToastPublicidad(null, "Campos vacíos", "Debes completar todos los campos", true);
        return;
    }

    setLoading("btnSubmitLogin", true, originalText);

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ correo, contrasena })
        });
        const data = await res.json();
        
        if (res.ok && data.ok) {
            sessionStorage.setItem("user", JSON.stringify(data.user));
            const rol = data.user.roles?.nombre_role || data.user.rol || "cliente";
            const saludo = rol === "admin" ? "Bienvenido Administrador" : "Bienvenido Cliente";
            mostrarToastPublicidad('/static/uploads/logo.png', "Sesión Iniciada", saludo, false);
            setTimeout(() => window.location.href = data.redirect || "/inicio", 1600);
        } else {
            mostrarToastPublicidad(null, "Error", data.error || "Credenciales incorrectas", true);
            setLoading("btnSubmitLogin", false, originalText);
        }
    } catch (err) {
        mostrarToastPublicidad(null, "Error", "Sin conexión con el servidor", true);
        setLoading("btnSubmitLogin", false, originalText);
    }
});

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
        navigator.serviceWorker.register('/static/js/workers/service-worker-login.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}