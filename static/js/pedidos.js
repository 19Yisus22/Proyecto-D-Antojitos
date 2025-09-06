const toastContainer = document.getElementById('toastContainer');
const itemsPorPagina = 5;
let pedidosGlobal = [];
let pedidosFiltrados = [];

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
  const pedidosMap = new Map();
  pedidos.forEach(p=>{
    if(!pedidosMap.has(p.id_pedido)) pedidosMap.set(p.id_pedido,{...p, items:[]});
    pedidosMap.get(p.id_pedido).items.push({
      nombre_producto: p.nombre_producto,
      cantidad: p.cantidad,
      total: p.total,
      pagado: p.pagado
    });
    pedidosMap.get(p.id_pedido).fecha_emision = p.fecha_emision;
    pedidosMap.get(p.id_pedido).cliente = p.cliente;
    pedidosMap.get(p.id_pedido).cedula = p.cedula;
    pedidosMap.get(p.id_pedido).direccion_entrega = p.direccion_entrega;
    pedidosMap.get(p.id_pedido).metodo_pago = p.metodo_pago;
    pedidosMap.get(p.id_pedido).imagen_url = p.imagen_url;
    pedidosMap.get(p.id_pedido).estado = p.estado;
    pedidosMap.get(p.id_pedido).pagado = p.pagado;
  });

  pedidosGlobal = Array.from(pedidosMap.values()).map(pedido=>{
    const card = document.createElement("div");
    card.className="pedido-card card-collapsed col-12 mb-3 p-2 shadow-sm";
    card.dataset.cliente=(pedido.cliente||'desconocido').toLowerCase();
    card.dataset.estado=pedido.estado;
    card.dataset.pagado=pedido.pagado;
    card.id=`pedido-${pedido.id_pedido}`;

    let itemsHTML = pedido.items.map(item=>{
      return `<tr>
        <td>${item.nombre_producto}</td>
        <td>${item.cantidad}</td>
        <td>${item.total.toLocaleString('es-CO',{style:'currency',currency:'COP'})}</td>
        <td>
          <i class="bi ${item.pagado?'bi-check-circle text-success':'bi-x-circle text-danger'} fs-4 toggle-pago" style="cursor:pointer" data-id="${pedido.id_pedido}" data-pagado="${item.pagado}"></i>
        </td>
      </tr>`;
    }).join("");

    const fechaStr = pedido.fecha_emision ? new Date(pedido.fecha_emision).toLocaleString('es-CO', {dateStyle:'short', timeStyle:'short'}) : 'No registrada';

    card.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <img src="${pedido.imagen_url || '/static/uploads/default.png'}" alt="Perfil" class="rounded-circle" style="width:40px;height:40px;object-fit:cover;">
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
          <p><strong>Cliente:</strong> ${pedido.cliente||'Desconocido'}</p>
          <p><strong>Cédula:</strong> ${pedido.cedula||'No registrada'}</p>
          <p><strong>Dirección:</strong> ${pedido.direccion_entrega||'No registrada'}</p>
          <p><strong>Método de Pago:</strong> ${pedido.metodo_pago||'No especificado'}</p>
          <table class="table table-sm mt-2 align-middle text-center">
            <thead class="table-light"><tr><th>Producto</th><th>Cantidad</th><th>Total</th><th>Pago</th></tr></thead>
            <tbody>${itemsHTML}</tbody>
          </table>
          <div class="mt-3">
            <select class="form-select estado-select">
              <option value="Pendiente" ${pedido.estado==='Pendiente'?'selected':''}>Pendiente</option>
              <option value="Entregado" ${pedido.estado==='Entregado'?'selected':''}>Entregado</option>
              <option value="Cancelado" ${pedido.estado==='Cancelado'?'selected':''}>Cancelado</option>
            </select>
            <button class="btn btn-primary btn-sm mt-2 actualizar-btn">Actualizar Estado</button>
          </div>
        </div>
      </div>`;

    card.querySelector(".toggle-detalle").addEventListener("click",()=>card.classList.toggle("card-collapsed"));

    card.querySelector(".actualizar-btn").addEventListener("click",async()=>{
      const nuevo_estado=card.querySelector(".estado-select").value;
      await fetch(`/actualizar_estado/${pedido.id_pedido}`,{
        method:"PUT",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({estado:nuevo_estado})
      });
      showMessage(`Estado del pedido #${pedido.id_pedido} actualizado a ${nuevo_estado}`);
      card.dataset.estado=nuevo_estado;
      aplicarFiltros();
    });

    card.querySelectorAll(".toggle-pago").forEach(icon=>{
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
