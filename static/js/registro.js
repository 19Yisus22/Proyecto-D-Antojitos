const form = document.getElementById("registerForm");
const toastContainer = document.getElementById("toastContainer");

function showMessage(msg, isError=false){
  const toastEl = document.createElement('div');
  toastEl.className='toast align-items-center text-bg-light border-0';
  toastEl.setAttribute('role','alert');
  toastEl.setAttribute('aria-live','assertive');
  toastEl.setAttribute('aria-atomic','true');
  toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${isError?'❌':'✅'} ${msg}</div><button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  toastContainer.appendChild(toastEl);
  new bootstrap.Toast(toastEl,{delay:2000}).show();
}

form.addEventListener("submit", async e => {
  e.preventDefault();
  const cedula = document.getElementById("cedula").value.trim();
  const nombre = document.getElementById("nombre").value.trim();
  const apellido = document.getElementById("apellido").value.trim();
  const correo = document.getElementById("correo").value.trim().toLowerCase();
  const telefono = document.getElementById("telefono").value.trim();
  const contrasena = document.getElementById("contrasena").value;

  if(!cedula || !nombre || !apellido || !correo || !contrasena){ showMessage("Completa todos los campos obligatorios", true); return; }
  if(!/^\d{6,15}$/.test(cedula)){ showMessage("Cédula inválida", true); return; }
  if(telefono && !/^\+?\d{7,15}$/.test(telefono)){ showMessage("Teléfono inválido", true); return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)){ showMessage("Correo inválido", true); return; }
  if(!/^(?=.*[a-zA-Z])(?=.*\d).{6,}$/.test(contrasena)){ showMessage("Contraseña insegura (mínimo 6 caracteres, letras y números)", true); return; }

  try {
    const res = await fetch("/registro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula, nombre, apellido, correo, telefono, contrasena })
    });
    const data = await res.json();
    if(res.ok && data.ok){
      showMessage("Registro exitoso, redirigiendo al login...");
      setTimeout(()=>window.location.href="/login", 2000);
    } else {
      if(data.error && data.error.toLowerCase().includes("cedula")) showMessage("Cédula ya registrada", true);
      else if(data.error && data.error.toLowerCase().includes("correo")) showMessage("Correo ya registrado", true);
      else showMessage(data.error || "Error en registro", true);
    }
  } catch(err) {
    showMessage("Error al conectar con el servidor", true);
  }
});

if('serviceWorker' in navigator){
    window.addEventListener('load',()=>navigator.serviceWorker.register('/static/js/service-worker-registro.js').then(()=>console.log('SW registrado')).catch(console.error));
}