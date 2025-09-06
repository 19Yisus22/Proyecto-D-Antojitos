const form = document.getElementById("loginForm");
const toastContainer = document.getElementById("toastContainer");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

function showMessage(msg, isSuccess=false) {
  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-bg-light border-0';
  toastEl.setAttribute('role','alert');
  toastEl.setAttribute('aria-live','assertive');
  toastEl.setAttribute('aria-atomic','true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${isSuccess ? '✅' : '❌'} ${msg}</div>
      <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  toastContainer.appendChild(toastEl);
  new bootstrap.Toast(toastEl,{delay:3000}).show();
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const contrasena = document.getElementById("contrasena").value.trim();
  if (!correo || !contrasena) {
    showMessage("Debes completar todos los campos");
    return;
  }
  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correo, contrasena })
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showMessage(data.error || "Usuario o contraseña incorrectos");
      return;
    }
    if (!data.user.roles || !["admin","cliente"].includes(data.user.roles.nombre_role)) {
      showMessage("Rol no permitido");
      return;
    }
    sessionStorage.setItem("user", JSON.stringify(data.user));
    showMessage(data.user.roles.nombre_role === "admin" ? "Bienvenido Administrador" : "Bienvenido Cliente", true);
    setTimeout(() => window.location.href = data.redirect || "/inicio", 600);
  } catch {
    showMessage("Error al conectar con el servidor");
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