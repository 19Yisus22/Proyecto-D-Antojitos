const form = document.getElementById("loginForm") || document.getElementById("registerForm");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("contrasena");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

function playNotificationSound(isError = false) {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const mainGain = audioCtx.createGain();
        mainGain.gain.setValueAtTime(0, audioCtx.currentTime);
        mainGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
        mainGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

        const osc1 = audioCtx.createOscillator();
        if (isError) {
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
        } else {
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime);
            osc2.connect(mainGain);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 1.2);
        }

        osc1.connect(mainGain);
        mainGain.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 1.2);
    } catch (e) { }
}

function showMessage(titulo, msg, isSuccess = true) {
    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        cont.className = "position-fixed bottom-0 start-0 p-3";
        cont.style.zIndex = "1080";
        document.body.appendChild(cont);
    }

    playNotificationSound(!isSuccess);

    const t = document.createElement("div");
    t.className = "custom-toast show shadow-lg mb-3";
    t.style.minWidth = "300px";
    t.style.borderRadius = "15px";
    t.style.backgroundColor = "#ffffff";
    t.style.borderLeft = `6px solid ${isSuccess ? '#f1a7b9' : '#e53e3e'}`;
    t.style.padding = "15px";
    t.style.transition = "all 0.4s ease";
    
    const accentColor = isSuccess ? '#d85a76' : '#e53e3e';
    const iconClass = isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';

    t.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-shrink-0 me-3">
                <i class="bi ${iconClass}" style="color: ${accentColor}; font-size: 1.6rem;"></i>
            </div>
            <div class="flex-grow-1">
                <strong style="color: #5d4037; font-size: 0.95rem; display: block;">${titulo}</strong>
                <small style="color: #a67c83; font-size: 0.85rem;">${msg}</small>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.75rem; color: #bdc3c7;"></i>
        </div>`;
    
    cont.appendChild(t);
    
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-30px)';
        setTimeout(() => t.remove(), 400);
    };
    
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 5000);
}

window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const isGoogleSuccess = urlParams.get('success_google');
    const nombre = urlParams.get('nombre');
    const rol = urlParams.get('rol');

    if (isGoogleSuccess) {
        showMessage("¡Bienvenido!", `Hola ${nombre}, has ingresado como ${rol}`, true);
        setTimeout(() => {
            window.location.href = "/inicio";
        }, 2000);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const errorMsg = urlParams.get('error');
    if (errorMsg) {
        const esErrorReloj = errorMsg.includes("Token used too early") || 
                             errorMsg.includes("iat") || 
                             errorMsg.includes("1769537647");

        if (esErrorReloj) {
            showMessage("Sincronización", "El reloj de tu equipo está desfasado. Por favor, ajústalo a la hora automática.", false);
        } else {
            showMessage("Error de Acceso", errorMsg, false);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});

function setLoading(isLoading) {
    const btn = document.getElementById("btnSubmitLogin") || document.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Horneando...`;
    } else {
        btn.innerHTML = btn.dataset.original;
    }
}

async function inicializarGoogle() {
    try {
        const res = await fetch("/obtener-cliente-id");
        const data = await res.json();
        if (data.client_id && window.google) {
            const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
            const redirectUri = isLocal 
                ? "http://localhost:8000/registro-google" 
                : "https://dantojitos.onrender.com/registro-google";

            google.accounts.id.initialize({
                client_id: data.client_id,
                ux_mode: 'redirect',
                login_uri: redirectUri,
                auto_select: false
            });

            const buttonDiv = document.getElementById("buttonDiv");
            if (buttonDiv) {
                google.accounts.id.renderButton(
                    buttonDiv,
                    { 
                        theme: "outline", 
                        size: "large", 
                        type: "standard",
                        shape: "pill",
                        text: "continue_with",
                        logo_alignment: "left",
                        width: buttonDiv.offsetWidth
                    }
                );
            }
        }
    } catch (err) { }
}

window.addEventListener('load', () => {
    if (window.location.search.includes('logout=true')) {
        sessionStorage.clear();
        localStorage.clear();
        if (window.google) google.accounts.id.disableAutoSelect();
    }
    inicializarGoogle();
});

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");
        this.classList.toggle("bi-eye");
        this.classList.toggle("bi-eye-slash");
    });
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const isLogin = form.id === "loginForm";
        const endpoint = isLogin ? "/login" : "/registro";
        
        const correo = document.getElementById("correo").value.trim().toLowerCase();
        const contrasena = document.getElementById("contrasena").value.trim();
        
        if (!correo || !contrasena) {
            showMessage("Campos Incompletos", "Por favor, llena los datos necesarios", false);
            return;
        }

        setLoading(true);

        let datos = isLogin ? { correo, contrasena } : {
            cedula: document.getElementById("cedula").value.trim(),
            nombre: document.getElementById("nombre").value.trim(),
            apellido: document.getElementById("apellido").value.trim(),
            correo,
            telefono: document.getElementById("telefono").value.trim(),
            contrasena
        };

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
                    showMessage("¡Dulce Entrada!", `Hola, ${data.user.nombre || 'bienvenido'}`, true);
                } else {
                    showMessage("Cuenta Creada", "Ya puedes iniciar sesión con tus datos", true);
                }
                setTimeout(() => {
                    window.location.href = isLogin ? (data.redirect || "/inicio") : "/login";
                }, 1600);
            } else {
                showMessage("Revisa tus datos", data.error || "Credenciales no coinciden", false);
                setLoading(false);
            }
        } catch (err) {
            showMessage("Error", "La cocina no responde, intenta más tarde", false);
            setLoading(false);
        }
    });
}

if (linkRegistro) {
    linkRegistro.addEventListener("click", (e) => {
        e.preventDefault();
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
        navigator.serviceWorker.register('/static/js/workers/service-worker-perfil.js');
        navigator.serviceWorker.register('/static/js/workers/service-worker-registro.js')
        .then(reg => { console.log('SW OK'); })
        .catch(err => { console.error('SW Error', err); });
    });
}