const toastContainer = document.getElementById('toastContainer');
const alertaCancelado = document.getElementById('alertaCancelado');
const itemsPorPagina = 5;
let pedidosGlobal = [];
let pedidosFiltrados = [];
let pedidosCanceladosVerificados = JSON.parse(localStorage.getItem("pedidosCanceladosVerificados") || "[]");

function showMessage(msg, isError=false){
  const toastEl = document.createElement('div');
  toastEl.className = 'toast align-items-center text-bg-light border-0';
  toastEl.setAttribute('role','alert');
  toastEl.setAttribute('aria-live','assertive');
  toastEl.setAttribute('aria-atomic','true');
  toastEl.innerHTML = `<div class="d-flex">
    <div class="toast-body">${isError ? '❌' : '✅'} ${msg}</div>
    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
  </div>`;
  toastContainer.appendChild(toastEl);
  new bootstrap.Toast(toastEl,{delay:1200}).show();
}

function mostrarAlertaCancelado(pedidoId){
  if(pedidosCanceladosVerificados.includes(pedidoId)) return;

  let modal = document.createElement("div");
  modal.className = "modal fade";
  modal.tabIndex = "-1";
  modal.innerHTML = `
    <div class="modal-dialog modal-dialog-centered">
      <div class="modal-content shadow-lg border-0 rounded-3">
        <div class="modal-header bg-danger text-white">
          <h5 class="modal-title">⚠ Pedido Cancelado</h5>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
        </div>
        <div class="modal-body text-center">
          <p class="fs-5">El pedido <strong>#${pedidoId}</strong> fue cancelado.</p>
          <p class="text-muted">Verifique este pedido antes de presionar el check.</p>
        </div>
        <div class="modal-footer justify-content-center">
          <button class="btn btn-success px-4" id="verificar-${pedidoId}">Verificado ✔</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();

  document.getElementById(`verificar-${pedidoId}`).addEventListener("click",()=>{
    pedidosCanceladosVerificados.push(pedidoId);
    localStorage.setItem("pedidosCanceladosVerificados", JSON.stringify(pedidosCanceladosVerificados));
    bsModal.hide();
  });

  modal.addEventListener("hidden.bs.modal",()=>modal.remove());
}

function renderizarPaginacion(lista){
  const totalPaginas = Math.ceil(lista.length / itemsPorPagina);
  const pagUl = document.getElementById("pagination");
  pagUl.innerHTML = "";
  for(let i=1;i<=totalPaginas;i++){
    const li = document.createElement("li");
    li.className = "page-item";
    li.innerHTML = `<a class="page-link" href="#">${i}</a>`;
    li.addEventListener("click",(e)=>{ e.preventDefault(); mostrarPagina(lista,i); });
    pagUl.appendChild(li);
  }
  actualizarTituloTabla();
  mostrarPagina(lista,1);
}

function mostrarPagina(lista,pagina){
  const cont = document.getElementById("tablaPedidos");
  cont.innerHTML = "";
  const inicio = (pagina-1)*itemsPorPagina;
  const fin = inicio + itemsPorPagina;
  lista.slice(inicio,fin).forEach(card=>{
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.appendChild(card);
    tr.appendChild(td);
    cont.appendChild(tr);
  });
}

function actualizarTituloTabla(){
  const titulo = document.getElementById("tituloTabla");
  const filtro = document.getElementById("filtroEstado").value;
  if(filtro==="Todos") titulo.textContent="Pedidos";
  else if(filtro==="Terminados") titulo.textContent="Pedidos Terminados";
  else titulo.textContent=`Pedidos ${filtro}`;
}

async function cargarPedidos(){
  const res = await fetch("/obtener_pedidos");
  const pedidos = await res.json();
  if(!Array.isArray(pedidos)) return;
  pedidosGlobal = pedidos.map(pedido=>{
    const card = document.createElement("div");
    card.className="pedido-card card-collapsed col-12 mb-3 p-2 shadow-sm";
    card.dataset.cliente=(pedido.usuarios?.nombre||'desconocido').toLowerCase();
    card.dataset.estado=pedido.estado;
    card.dataset.pagado=pedido.pagado;
    card.id=`pedido-${pedido.id_pedido}`;
    let itemsHTML = (pedido.pedido_detalle||[]).map(item=>{
      return `<tr>
        <td>${item.nombre_producto}</td>
        <td>${item.cantidad}</td>
        <td>${item.subtotal.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
        <td>
          <i class="bi ${pedido.pagado?'bi-check-circle text-success':'bi-x-circle text-danger'} fs-4 toggle-pago" style="cursor:pointer" data-id="${pedido.id_pedido}" data-pagado="${pedido.pagado}"></i>
        </td>
      </tr>`;
    }).join("");
    const fechaStr = pedido.fecha_pedido ? new Date(pedido.fecha_pedido).toLocaleString('es-CO', {dateStyle:'short', timeStyle:'short'}) : 'No registrada';
    card.innerHTML = `
      <div class="card ${pedido.estado==='Cancelado'?'bg-light text-muted':''}">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <img src="${pedido.usuarios?.imagen_url || '/static/uploads/default.png'}" alt="Perfil" class="rounded-circle perfil-img" style="width:40px;height:40px;object-fit:cover;cursor:pointer;">
            <div>
              <strong>Pedido #${pedido.id_pedido}</strong><br>
              <small>Estado: ${pedido.estado} - ${pedido.pagado?'Pagado':'No Pagado'} | Fecha: ${fechaStr}</small>
            </div>
          </div>
          <div class="d-flex gap-2">
            <i class="bi bi-chevron-down icono fs-4 toggle-detalle"></i>
            <i class="bi bi-trash icono text-danger fs-4" onclick="this.closest('.pedido-card').classList.toggle('seleccion');"></i>
          </div>
        </div>
        <div class="card-body">
          <p><strong>Cliente:</strong> ${(pedido.usuarios?.nombre||'Desconocido')} ${(pedido.usuarios?.apellido||'')}</p>
          <p><strong>Cédula:</strong> ${pedido.usuarios?.cedula||'No registrada'}</p>
          <p><strong>Dirección:</strong> ${pedido.direccion_entrega||'No registrada'}</p>
          <p><strong>Método de Pago:</strong> ${pedido.metodo_pago||'No especificado'}</p>
          <table class="table table-sm mt-2 align-middle text-center">
            <thead class="table-light"><tr><th>Producto</th><th>Cantidad</th><th>Total</th><th>Pago</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          <div class="mt-3">
            <select class="form-select estado-select" ${pedido.estado==='Cancelado'?'disabled':''}>
              <option value="Pendiente" ${pedido.estado==='Pendiente'?'selected':''}>Pendiente</option>
              <option value="Entregado" ${pedido.estado==='Entregado'?'selected':''}>Entregado</option>
              <option value="Cancelado" ${pedido.estado==='Cancelado'?'selected':''}>Cancelado</option>
            </select>
            <button class="btn btn-primary btn-sm mt-2 actualizar-btn" ${pedido.estado==='Cancelado'?'disabled':''}>Actualizar Estado</button>
          </div>
        </div>
      </div>`;
    if(pedido.estado==="Cancelado"){ mostrarAlertaCancelado(pedido.id_pedido); }
    card.querySelector(".toggle-detalle").addEventListener("click",()=>card.classList.toggle("card-collapsed"));
    card.querySelector(".actualizar-btn")?.addEventListener("click",async()=>{
      const nuevo_estado=card.querySelector(".estado-select").value;
      await fetch(`/actualizar_estado/${pedido.id_pedido}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({estado:nuevo_estado})
      });
      card.dataset.estado=nuevo_estado;
      aplicarFiltros();
    });
    card.querySelectorAll(".toggle-pago").forEach(icon=>{
      if(pedido.estado==='Cancelado') icon.style.pointerEvents='none';
      icon.addEventListener("click", async ()=>{
        const id = icon.dataset.id;
        const pagadoActual = icon.dataset.pagado === 'true';
        const nuevoPago = !pagadoActual;
        const res = await fetch(`/actualizar_pago/${id}`,{
          method:"PUT",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({pagado:nuevoPago})
        });
        if(res.ok){
          icon.classList.toggle("bi-check-circle", nuevoPago);
          icon.classList.toggle("text-success", nuevoPago);
          icon.classList.toggle("bi-x-circle", !nuevoPago);
          icon.classList.toggle("text-danger", !nuevoPago);
          icon.dataset.pagado = nuevoPago;
          card.dataset.pagado = nuevoPago;
          aplicarFiltros();
          showMessage(`Pago del pedido #${id} actualizado`);
        } else {
          showMessage("No se pudo actualizar el pago", true);
        }
      });
    });
    card.querySelector(".perfil-img").addEventListener("click",()=>{
      const imgUrl = pedido.usuarios?.imagen_url || '/static/uploads/default.png';
      const modal = document.createElement("div");
      modal.className="modal fade";
      modal.tabIndex="-1";
      modal.innerHTML=`
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-body text-center">
              <img src="${imgUrl}" alt="Perfil" style="max-width:100%;height:auto;border-radius:10px;">
            </div>
          </div>
        </div>`;
      document.body.appendChild(modal);
      const bsModal = new bootstrap.Modal(modal);
      bsModal.show();
      modal.addEventListener("hidden.bs.modal",()=>modal.remove());
    });
    return card;
  });
  pedidosFiltrados=[...pedidosGlobal];
  aplicarFiltros();
}

function aplicarFiltros(){
  const val=document.getElementById("buscarCliente").value.toLowerCase();
  const estado=document.getElementById("filtroEstado").value;
  pedidosFiltrados=pedidosGlobal.filter(card=>{
    const matchesCliente=card.dataset.cliente.includes(val);
    let matchesEstado=true;
    if(estado==="Terminados"){ matchesEstado=card.dataset.estado==="Entregado" && card.dataset.pagado==="true"; }
    else if(estado!=="Todos"){ matchesEstado=card.dataset.estado===estado; }
    return matchesCliente && matchesEstado;
  });
  renderizarPaginacion(pedidosFiltrados);
}

document.getElementById("buscarCliente").addEventListener("input", aplicarFiltros);
document.getElementById("filtroEstado").addEventListener("change", aplicarFiltros);
document.getElementById("eliminarSeleccionados").addEventListener("click",async()=>{
  const seleccionados=document.querySelectorAll(".pedido-card.seleccion");
  if(seleccionados.length===0){ showMessage("No hay pedidos seleccionados",true); return; }
  for(const card of seleccionados){
    const idPedido=card.id.replace("pedido-","");
    await fetch(`/eliminar_pedido/${idPedido}`,{method:"DELETE"});
    card.remove();
  }
  pedidosGlobal=pedidosGlobal.filter(c=>!c.classList.contains("seleccion"));
  pedidosFiltrados=pedidosFiltrados.filter(c=>!c.classList.contains("seleccion"));
  aplicarFiltros();
  showMessage("Pedidos Eliminados");
});

cargarPedidos();