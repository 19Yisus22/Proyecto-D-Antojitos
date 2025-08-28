import os
import socket
import secrets
import logging
import websockets
import cloudinary
import cloudinary.uploader
from waitress import serve
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from passlib.context import CryptContext
from flask import Flask, request, jsonify, render_template, session, redirect, url_for

# RUTAS Y DIRECTORIOS
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# VARIABLES DE ENTORNO
env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)

# CONEXION A SUPABASE
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
SUPABASE_KEY = os.getenv("SUPABASE_KEY") or "TU_KEY_POR_DEFECTO"

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Faltan las credenciales de Supabase en el archivo .env")

supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# CONEXION A CLOUDINARY
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
    raise ValueError("Faltan las credenciales de Cloudinary en el archivo .env")

cloudinary.config( cloud_name=CLOUDINARY_CLOUD_NAME, api_key=CLOUDINARY_API_KEY, api_secret=CLOUDINARY_API_SECRET)

# CONFIGURACION DE FLASK
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(24)
app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
app.secret_key = FLASK_SECRET_KEY
CORS(app, supports_credentials=True)
logging.getLogger('waitress').setLevel(logging.ERROR)

# CONFIGURACIÓN PARA SUBIDA DE ARCHIVOS
UPLOAD_FOLDER = 'uploads'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'ico'}

# HASHING DE CONTRASEÑAS
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def allowed_file(filename):
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS

def upload_image_to_cloudinary(file, folder="mi_app", public_id=None):
    if not public_id:
        public_id = secrets.token_hex(8)
    result = cloudinary.uploader.upload(
        file,
        folder=folder,
        public_id=public_id,
        overwrite=True,
        resource_type="image"
    )
    return result.get("secure_url")

def delete_image_from_cloudinary(public_url):
    parts = public_url.split("/")[-2:]
    public_id = "/".join(parts).split(".")[0]
    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
        return True
    except:
        return False

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        if "file" not in request.files or request.files["file"].filename == "":
            return render_template("inicio.html", mensaje="No se seleccionó archivo")
        file = request.files["file"]
        if file and allowed_file(file.filename):
            url_imagen = upload_image_to_cloudinary(file, folder="uploads")
            return render_template("inicio.html", mensaje="Archivo subido correctamente", url_imagen=url_imagen)
        return render_template("inicio.html", mensaje="Extensión de archivo no permitida")
    return render_template("inicio.html")

def login_usuario(correo, contrasena):
    res = supabase.table("usuarios").select("*, roles(nombre_role), roles_permisos(permisos(nombre_permiso))").eq("correo", correo).execute()
    if not res.data:
        return None
    user = res.data[0]
    try:
        valido = pwd_context.verify(contrasena, user["contrasena"])
    except Exception:
        valido = contrasena == user["contrasena"]
    return user if valido else None

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    if not request.is_json:
        return jsonify({"ok": False, "error": "Content-Type application/json requerido"}), 415
    data = request.get_json()
    correo, contrasena = data.get("correo", "").strip().lower(), data.get("contrasena", "")
    if not correo or not contrasena:
        return jsonify({"ok": False, "error": "Debes ingresar correo y contraseña"}), 400
    res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("correo", correo).execute()
    if not res.data:
        return jsonify({"ok": False, "error": "Correo o contraseña incorrectos"}), 401
    user = res.data[0]
    try:
        valido = pwd_context.verify(contrasena, user["contrasena"])
    except Exception:
        valido = contrasena == user["contrasena"]
    if not valido:
        return jsonify({"ok": False, "error": "Correo o contraseña incorrectos"}), 401
    permisos_res = supabase.table("roles_permisos").select("permisos(nombre_permiso)").eq("id_role", user["id_role"]).execute()
    permisos = [p["permisos"]["nombre_permiso"] for p in permisos_res.data if p.get("permisos")]
    session["user_id"], session["rol"], session["permisos"], session["just_logged_in"] = user["id_cliente"], user["roles"]["nombre_role"], permisos, True
    return jsonify({"ok": True, "redirect": "/inicio", "user": user, "permisos": permisos}), 200
 
@app.route("/inicio")
def inicio():
    user, just_logged_in, pedidos_nuevos = None, False, False
    user_id = session.get("user_id")

    if user_id:
        res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", user_id).maybe_single().execute()

        if res is not None and res.data:
            user = res.data

            if not user.get("imagen_url"):
                user["imagen_url"] = "https://res.cloudinary.com/dmknjcrua/image/upload/v1755983018/defaults/default_icon_profile.png"

            just_logged_in = session.pop("just_logged_in", False)

            permisos_res = supabase.table("roles_permisos").select("permisos(nombre_permiso)").eq("id_role", user["id_role"]).execute()
            user["permisos"] = [p["permisos"]["nombre_permiso"] for p in permisos_res.data if p.get("permisos")]
            session["permisos"] = user["permisos"]

            if user["roles"]["nombre_role"] == "admin" and "ver_pedidos" in user["permisos"]:
                pedidos_res = supabase.table("pedidos").select("*").eq("estado", "nuevo").execute()
                pedidos_nuevos = bool(pedidos_res.data) if pedidos_res.data else False
        else:
            session.clear()
    else:
        session.clear()

    return render_template("inicio.html", user=user, just_logged_in=just_logged_in, pedidos_nuevos=pedidos_nuevos)

@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"success": True})

@app.route("/registro", methods=["GET", "POST", "OPTIONS"])
def registro():
    if request.method == "OPTIONS":
        return "", 200
    if request.method == "GET":
        return render_template("registro.html")
    if not request.is_json:
        return jsonify({"ok": False, "error": "Content-Type application/json requerido"}), 415
    payload = request.get_json()
    cedula, nombre, apellido, telefono, correo, contrasena = (
        payload.get("cedula", "").strip(),
        payload.get("nombre", "").strip(),
        payload.get("apellido", "").strip(),
        payload.get("telefono", "").strip(),
        payload.get("correo", "").strip().lower(),
        payload.get("contrasena", "")
    )
    if not all([cedula, nombre, apellido, correo, contrasena]):
        return jsonify({"ok": False, "error": "Todos los campos son obligatorios"}), 400
    hashed = pwd_context.hash(contrasena)
    default_img = "static/uploads/default_icon_profile.png"
    try:
        res = supabase.table("usuarios").insert({
            "cedula": cedula,
            "nombre": nombre,
            "apellido": apellido,
            "telefono": telefono,
            "correo": correo,
            "contrasena": hashed,
            "metodo_pago": "Efectivo",
            "imagen_url": default_img
        }).execute()
        if not res.data:
            return jsonify({"ok": False, "error": "No se pudo registrar el usuario"}), 400
        return jsonify({"ok": True, "mensaje": "✅ Usuario registrado exitosamente"}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
   
# APARTADO DE PERFILES

@app.route("/mi_perfil", methods=["GET", "POST"])
def mi_perfil():
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for("login"))

    res_usuario = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", user_id).single().execute()
    usuario = res_usuario.data if res_usuario.data else {}
    usuario["imagen_url"] = usuario.get("imagen_url") or "/static/default_icon_profile.png"

    if request.method == "POST":
        updates = {}
        for campo in ["nombre","apellido","telefono","correo","direccion","cedula","metodo_pago"]:
            valor = request.form.get(campo)
            if valor:
                updates[campo] = valor.strip().lower() if campo=="correo" else valor.strip()

        imagen_file = request.files.get("imagen_url")
        if imagen_file and imagen_file.filename:
            url_imagen = upload_image_to_cloudinary(imagen_file, folder="usuarios", public_id=f"foto_perfil_{user_id}")
            updates["imagen_url"] = url_imagen

        if request.form.get("eliminar_foto")=="1" and usuario.get("imagen_url") and "default_icon_profile.png" not in usuario["imagen_url"]:
            delete_image_from_cloudinary(usuario["imagen_url"])
            updates["imagen_url"] = "/static/default_icon_profile.png"

        if updates:
            supabase.table("usuarios").update(updates).eq("id_cliente", user_id).execute()
    return render_template("mi_perfil.html", user=usuario)

@app.route("/actualizar_perfil/<id_cliente>", methods=["PUT", "POST"])
def actualizar_perfil(id_cliente):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "No autorizado"}), 401

    user_res = supabase.table("usuarios").select("*").eq("id_cliente", id_cliente).single().execute()
    if not user_res.data:
        return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404

    data = request.form if request.form else request.json
    campos_actualizar = {
        'nombre': data.get('nombrePerfil','').strip(),
        'apellido': data.get('apellidoPerfil','').strip(),
        'telefono': data.get('telefonoPerfil','').strip(),
        'correo': data.get('correoPerfil','').strip().lower(),
        'direccion': data.get('direccionPerfil','').strip(),
        'cedula': data.get('cedulaPerfil','').strip(),
        'metodo_pago': data.get('metodoPagoPerfil','').strip()
    }

    imagen_file = request.files.get("imagen_url")
    if imagen_file and imagen_file.filename:
        url_imagen = upload_image_to_cloudinary(imagen_file, folder="usuarios", public_id=f"foto_perfil_{id_cliente}")
        campos_actualizar["imagen_url"] = url_imagen

    campos_actualizar = {k:v for k,v in campos_actualizar.items() if v}
    if not campos_actualizar:
        return jsonify({"ok": False, "error": "No se enviaron datos"}), 400

    supabase.table("usuarios").update(campos_actualizar).eq("id_cliente", id_cliente).execute()
    user_res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", id_cliente).single().execute()
    usuario = user_res.data
    usuario["imagen_url"] = usuario.get("imagen_url") or "/static/default_icon_profile.png"
    return jsonify({"ok": True, "usuario": usuario})

@app.route("/actualizar_rol_usuario", methods=["PUT"])
def actualizar_rol_usuario():
    data = request.get_json()
    id_usuario = data.get("id")
    nuevo_rol = data.get("rol")

    res_rol = supabase.table("roles").select("id_role").eq("nombre_role", nuevo_rol).single().execute()
    if not res_rol.data:
        return jsonify({"ok": False, "error": "Rol no encontrado"}), 404

    rol_id = res_rol.data.get("id_role")
    supabase.table("usuarios").update({"id_role": rol_id}).eq("id_cliente", id_usuario).execute()
    return jsonify({"ok": True})

@app.route("/listar_usuarios", methods=["GET"])
def listar_usuarios():
    res = supabase.table("usuarios").select("id_cliente,nombre,apellido,correo,id_role,fecha_creacion,imagen_url, roles(nombre_role)").execute()
    usuarios = res.data if res.data else []
    return jsonify(usuarios)

@app.route("/cambiar_contrasena", methods=["PUT"])
def cambiar_contrasena():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False,"error": "No autorizado"}), 401

    data = request.get_json()
    nueva = data.get("nueva","").strip()
    if not nueva:
        return jsonify({"ok": False,"error": "Contraseña requerida"}), 400

    supabase.table("usuarios").update({"contrasena": nueva}).eq("id_cliente", user_id).execute()
    return jsonify({"ok": True})

@app.route("/eliminar_usuario_por_correo", methods=["DELETE"])
def eliminar_usuario_por_correo():
    data = request.get_json()
    correo = data.get("correo","").strip().lower()
    if not correo:
        return jsonify({"ok": False,"error": "Correo requerido"}), 400

    res_usuario = supabase.table("usuarios").select("*").eq("correo", correo).single().execute()
    if not res_usuario.data:
        return jsonify({"ok": False,"error": "Usuario no encontrado"}), 404

    usuario = res_usuario.data
    if usuario.get("imagen_url") and "default_icon_profile.png" not in usuario["imagen_url"]:
        delete_image_from_cloudinary(usuario["imagen_url"])

    supabase.table("usuarios").delete().eq("correo", correo).execute()
    return jsonify({"ok": True})

# APARTADO DE GETION DE PRODUCTOS

@app.route("/gestionar_productos_page", methods=["GET"])
def productos_page():
    return render_template("gestion_productos.html")

@app.route("/gestionar_productos", methods=["GET", "POST"])
def gestionar_productos():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "No autorizado"}), 401

    if request.method == "GET":
        data = supabase.table("gestion_productos").select("*").order("fecha_creacion", desc=True).execute()
        return jsonify(data.data)

    if request.method == "POST":
        nombre = request.form.get("nombre", "").strip()
        descripcion = request.form.get("descripcion", "").strip()
        precio = float(request.form.get("precio", 0))
        stock = int(request.form.get("stock", 0))
        categoria = request.form.get("categoria", "Postre").strip() or "Postre"
        foto_base64 = request.form.get("foto_base64")

        imagen_url = upload_image_to_cloudinary(
            f"data:image/png;base64,{foto_base64}", folder="productos"
        ) if foto_base64 else None

        nuevo_producto = {
            "nombre": nombre,
            "descripcion": descripcion,
            "precio": precio,
            "stock": stock,
            "imagen_url": imagen_url,
            "categoria": categoria,
            "estado": True
        }

        ins = supabase.table("gestion_productos").insert(nuevo_producto).execute()
        prod = ins.data[0] if ins.data else None
        return jsonify({"ok": True, "producto": prod})

@app.route("/actualizar_producto/<id_producto>", methods=["PUT", "OPTIONS"])
def actualizar_producto(id_producto):
    if request.method == "OPTIONS":
        return "", 200

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "No autorizado"}), 401

    updates = {}
    for campo in ["nombre", "descripcion", "precio", "stock", "categoria"]:
        if campo in request.form:
            updates[campo] = (
                float(request.form[campo]) if campo == "precio"
                else int(request.form[campo]) if campo == "stock"
                else request.form[campo].strip()
            )

    if "estado" in request.form:
        updates["estado"] = str(request.form["estado"]).lower() in ["true","1","on","sí","si"]

    foto_base64 = request.form.get("foto_base64")
    if foto_base64:
        res_producto = supabase.table("gestion_productos").select("*").eq("id_producto", id_producto).single().execute()
        producto_actual = res_producto.data
        if producto_actual and producto_actual.get("imagen_url"):
            delete_image_from_cloudinary(producto_actual["imagen_url"])
        updates["imagen_url"] = upload_image_to_cloudinary(
            f"data:image/png;base64,{foto_base64}", folder="productos"
        )

    upd = supabase.table("gestion_productos").update(updates).eq("id_producto", id_producto).execute()
    prod = upd.data[0] if upd.data else {"id_producto": id_producto, **updates}
    return jsonify({"ok": True, "producto": prod})

@app.route("/eliminar_producto/<id_producto>", methods=["DELETE", "OPTIONS"])
def eliminar_producto(id_producto):
    if request.method == "OPTIONS":
        return "", 200

    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "error": "No autorizado"}), 401

    res_producto = supabase.table("gestion_productos").select("*").eq("id_producto", id_producto).single().execute()
    producto_actual = res_producto.data
    if producto_actual and producto_actual.get("imagen_url"):
        delete_image_from_cloudinary(producto_actual["imagen_url"])

    supabase.table("gestion_productos").delete().eq("id_producto", id_producto).execute()
    return jsonify({"ok": True})

# CATALOGO

@app.route("/catalogo_page", methods=["GET"])
def catalogo_page():
    try:
        user_id = session.get("user_id")
        userLogged = True if user_id else False

        res = supabase.table("gestion_productos").select("*").eq("estado", True).execute()
        productos = res.data or []
        for p in productos:
            p["agotado"] = p.get("stock", 0) <= 0
            p["imagen_url"] = p.get("imagen_url", "")

        return render_template("catalogo.html", productos=productos, userLogged=userLogged)
    except Exception as e:
        return f"Error cargando catálogo: {str(e)}", 500

@app.route("/obtener_catalogo", methods=["GET"])
def obtener_catalogo():
    try:
        res = supabase.table("gestion_productos").select("*").eq("estado", True).execute()
        productos = res.data or []

        catalogo = [{
            "id_producto": p["id_producto"],
            "nombre": p.get("nombre", ""),
            "descripcion": p.get("descripcion", ""),
            "precio": float(p.get("precio", 0)),
            "stock": p.get("stock", 0),
            "imagen_url": p.get("imagen_url", ""),
            "categoria": p.get("categoria", "Postre"),
            "fecha": str(p.get("fecha_creacion", ""))}
            for p in productos]

        return jsonify({"productos": catalogo})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/guardar_catalogo", methods=["POST"])
def guardar_catalogo():
    try:
        user_id = session.get("user_id")
        if not user_id:
            return {"error": "Usuario no autenticado"}, 401

        data = request.json
        productos = data.get("productos", [])
        if not productos:
            return {"error": "No hay productos para guardar"}, 400

        insert_catalogo, insert_carrito = [], []

        for p in productos:
            prod_res = (
                supabase.table("gestion_productos")
                .select("nombre, stock, precio, imagen_url")
                .eq("id_producto", p["id_producto"])
                .single()
                .execute()
            )
            if not prod_res.data:
                return {"error": f"Producto {p.get('nombre_producto','')} no existe"}, 400

            stock_actual = int(prod_res.data.get("stock", 0))
            nombre_producto = prod_res.data.get("nombre", "")
            precio_unitario = float(prod_res.data.get("precio", 0))

            if stock_actual < int(p["cantidad"]):
                return {"error": f"Stock insuficiente para {nombre_producto}"}, 400

            insert_catalogo.append({
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": int(p["cantidad"])
            })

            insert_carrito.append({
                "id_cliente": user_id,
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": int(p["cantidad"]),
                "precio_unitario": precio_unitario,
                "total": precio_unitario * int(p["cantidad"])
            })

        supabase.table("catalogo").insert(insert_catalogo).execute()
        supabase.table("carrito").insert(insert_carrito).execute()

        for p in insert_catalogo:
            prod_res = supabase.table("gestion_productos").select("stock").eq("id_producto", p["id_producto"]).single().execute()
            nuevo_stock = int(prod_res.data.get("stock", 0)) - int(p["cantidad"])
            supabase.table("gestion_productos").update({"stock": nuevo_stock}).eq("id_producto", p["id_producto"]).execute()

        return {"message": "Productos agregados al carrito"}, 200
    except Exception as e:
        return {"error": str(e)}, 500

# CARRITO

@app.route("/carrito_page")
def carrito_page():
    user_id = session.get("user_id")
    userLogged = bool(user_id)
    mensaje = "" if userLogged else "Debes iniciar sesión para acceder al carrito"
    return render_template("carrito.html", userLogged=userLogged, mensaje=mensaje)

@app.route("/agregar_al_carrito", methods=["POST"])
def agregar_al_carrito():
    id_cliente = session.get("user_id")
    if not id_cliente:
        return {"error": "Inicie sesión para agregar productos al carrito"}, 401

    data = request.json
    productos = data.get("productos", [])
    if not productos:
        return {"error": "No hay productos para agregar al carrito"}, 400

    insert_data, carrito_response = [], []

    for p in productos:
        prod_res = supabase.table("gestion_productos")\
            .select("nombre, precio, stock, imagen_url")\
            .eq("id_producto", p["id_producto"]).single().execute()
        if not prod_res.data:
            return {"error": f"Producto {p.get('nombre_producto','')} no existe"}, 400

        stock_actual = int(prod_res.data.get("stock", 0))
        nombre_producto = prod_res.data.get("nombre", "")
        precio_unitario = float(prod_res.data.get("precio", 0))
        imagen_url = prod_res.data.get("imagen_url", "")
        cantidad = int(p["cantidad"])
        if stock_actual < cantidad:
            return {"error": f"Stock insuficiente para {nombre_producto}"}, 400

        total = precio_unitario * cantidad
        insert_data.append({
            "id_cliente": id_cliente,
            "id_producto": p["id_producto"],
            "nombre_producto": nombre_producto,
            "cantidad": cantidad,
            "precio_unitario": precio_unitario,
            "total": total
        })
        supabase.table("gestion_productos")\
            .update({"stock": stock_actual - cantidad})\
            .eq("id_producto", p["id_producto"]).execute()

        carrito_response.append({
            "id_producto": p["id_producto"],
            "nombre_producto": nombre_producto,
            "cantidad": cantidad,
            "precio_unitario": precio_unitario,
            "total": total,
            "imagen_url": imagen_url,
            "stock_restante": stock_actual - cantidad
        })

    supabase.table("carrito").insert(insert_data).execute()
    return jsonify({"message": "Productos agregados al carrito correctamente", "carrito": carrito_response}), 200

@app.route("/obtener_carrito", methods=["GET"])
def obtener_carrito():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"productos": []})
    carrito_res = supabase.table("carrito").select("*").eq("id_cliente", user_id).execute()
    carrito = carrito_res.data or []
    ids_productos = [item["id_producto"] for item in carrito]
    productos_res = supabase.table("gestion_productos").select("*").in_("id_producto", ids_productos).execute()
    productos = {p["id_producto"]: p for p in productos_res.data or []}
    carrito_completo = []
    for item in carrito:
        prod = productos.get(item["id_producto"], {})
        carrito_completo.append({
            "id_carrito": item["id_carrito"],
            "id_producto": item["id_producto"],
            "nombre_producto": prod.get("nombre", item.get("nombre_producto","")),
            "descripcion": prod.get("descripcion",""),
            "cantidad": int(item.get("cantidad", 1)),
            "precio_unitario": float(prod.get("precio",0)),
            "subtotal": float(prod.get("precio",0)) * int(item.get("cantidad",1)),
            "imagen_url": prod.get("imagen_url") or "",
            "stock": int(prod.get("stock",0)),
            "agotado": int(prod.get("stock",0)) <= 0
        })
    return jsonify({"productos": carrito_completo})

@app.route("/carrito_quitar/<id_carrito>", methods=["DELETE"])
def carrito_quitar(id_carrito):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"ok": False, "message": "Debe iniciar sesión"}), 401

    carrito_item_res = supabase.table("carrito").select("*").eq("id_carrito", id_carrito).single().execute()
    item = carrito_item_res.data
    if item and item.get("id_cliente") == user_id:
        stock_actual_res = supabase.table("gestion_productos").select("stock").eq("id_producto", item["id_producto"]).single().execute()
        stock_actual = stock_actual_res.data.get("stock", 0) if stock_actual_res.data else 0
        supabase.table("gestion_productos").update({"stock": int(item.get("cantidad",1)) + stock_actual}).eq("id_producto", item["id_producto"]).execute()
        supabase.table("carrito").delete().eq("id_carrito", id_carrito).execute()
        return jsonify({"ok": True, "message": "Producto eliminado del carrito"})
    return jsonify({"ok": False, "message": "Producto no encontrado"}), 404

@app.route("/finalizar_compra", methods=["POST"])
def finalizar_compra():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"message": "Debe iniciar sesión"}), 401

    usuario_res = supabase.table("usuarios").select("nombre, apellido, cedula, direccion, metodo_pago").eq("id_cliente", user_id).single().execute()
    usuario = usuario_res.data
    if not usuario or not usuario.get("direccion"):
        return jsonify({"message": "Usuario no tiene dirección registrada"}), 400

    carrito_res = supabase.table("carrito").select("*").eq("id_cliente", user_id).execute()
    carrito = carrito_res.data or []
    if not carrito:
        return jsonify({"message": "Carrito vacío"}), 400

    pedidos_creados, facturas_creadas, total_compra = [], [], 0
    ids_productos = [item["id_producto"] for item in carrito]
    productos_res = supabase.table("gestion_productos").select("*").in_("id_producto", ids_productos).execute()
    productos = {p["id_producto"]: p for p in productos_res.data or []}

    for item in carrito:
        prod = productos.get(item["id_producto"])
        if not prod:
            continue
        cantidad = int(item.get("cantidad", 1))
        total_item = float(prod.get("precio", 0)) * cantidad
        total_compra += total_item

        pedido_res = supabase.table("pedidos").insert({
            "id_cliente": user_id,
            "id_producto": item["id_producto"],
            "nombre_producto": prod.get("nombre",""),
            "cantidad": cantidad,
            "total": total_item,
            "direccion_entrega": usuario["direccion"],
            "metodo_pago": usuario.get("metodo_pago","Efectivo"),
            "estado": "Pendiente",
            "pagado": False
        }).execute()

        if pedido_res.data:
            pedido_creado = pedido_res.data[0]
            pedidos_creados.append({
                **pedido_creado,
                "nombre_cliente": f"{usuario['nombre']} {usuario['apellido']}",
                "cedula": usuario["cedula"]
            })

            factura_res = supabase.table("facturas").insert({
                "id_cliente": user_id,
                "id_pedido": pedido_creado["id_pedido"],
                "subtotal": total_item,
                "total": total_item,
                "metodo_pago": usuario.get("metodo_pago","Efectivo"),
                "estado": "Emitida"
            }).execute()

            if factura_res.data:
                facturas_creadas.append(factura_res.data[0])

        supabase.table("gestion_productos").update({"stock": max(0, int(prod.get("stock",0)) - cantidad)}).eq("id_producto", item["id_producto"]).execute()

    supabase.table("carrito").delete().eq("id_cliente", user_id).execute()

    return jsonify({
        "message": "Pedido enviado y factura generada con éxito",
        "total": total_compra,
        "pedidos": pedidos_creados,
        "facturas": facturas_creadas
    })

@app.route("/buscar_facturas", methods=["GET"])
def buscar_facturas():
    query = request.args.get("q", "").strip()
    if not query:
        return jsonify([])

    facturas_res = supabase.table("facturas") \
        .select("id_factura, id_pedido, numero_factura, subtotal, total, metodo_pago, fecha_emision, estado, id_cliente") \
        .execute()
    facturas = facturas_res.data or []

    usuarios_res = supabase.table("usuarios") \
        .select("id_cliente, nombre, apellido, cedula") \
        .execute()
    usuarios = {u["id_cliente"]: u for u in usuarios_res.data or []}

    resultados = []
    for f in facturas:
        usuario = usuarios.get(f["id_cliente"], {})
        cedula_cliente = usuario.get("cedula", "")
        if query == cedula_cliente:
            pedidos_res = supabase.table("pedidos") \
                .select("id_pedido, id_producto, nombre_producto, cantidad, total") \
                .eq("id_pedido", f["id_pedido"]).execute()
            pedidos = pedidos_res.data or []
            resultados.append({
                "id_factura": f["id_factura"],
                "id_pedido": f["id_pedido"],
                "numero_factura": f["numero_factura"],
                "subtotal": f["subtotal"],
                "total": f["total"],
                "metodo_pago": f["metodo_pago"],
                "fecha_emision": f["fecha_emision"],
                "estado": f["estado"],
                "nombre_cliente": f"{usuario.get('nombre','')} {usuario.get('apellido','')}",
                "cedula": cedula_cliente,
                "pedidos": pedidos
            })

    return jsonify(resultados)

# APARTADO DE COMENTARIOS

@app.route("/comentarios_page", methods=["GET"])
def comentarios_page():
    user_id = session.get("user_id")
    if not user_id:
        return redirect(url_for("login"))

    res_usuario = supabase.table("usuarios").select("id_cliente,nombre,apellido,imagen_url").eq("id_cliente", user_id).single().execute()
    user = res_usuario.data
    if not user:
        return redirect(url_for("login"))

    comentarios_res = supabase.table("comentarios").select("*").order("created_at", desc=False).execute()
    comentarios = comentarios_res.data or []

    usuarios_res = supabase.table("usuarios").select("id_cliente,nombre,apellido,imagen_url").execute()
    usuarios_dict = {u["id_cliente"]: {
                        "nombre_usuario": f"{u['nombre']} {u['apellido']}".strip(),
                        "foto_perfil": u.get("imagen_url")
                     } for u in usuarios_res.data} if usuarios_res.data else {}

    for c in comentarios:
        info = usuarios_dict.get(c["id_usuario"], {"nombre_usuario": "Usuario", "foto_perfil": None})
        c["usuario_info"] = info
        if not c.get("foto_perfil"):
            c["foto_perfil"] = info["foto_perfil"]

    return render_template("comentarios.html", comentarios=comentarios, user_id=user_id)

@app.route("/comentarios", methods=["GET"])
def obtener_comentarios():
    comentarios_res = supabase.table("comentarios").select("*").order("created_at", desc=False).execute()
    comentarios = comentarios_res.data or []

    usuarios_res = supabase.table("usuarios").select("id_cliente,nombre,apellido,imagen_url").execute()
    usuarios_dict = {u["id_cliente"]: {"nombre_usuario": f"{u['nombre']} {u['apellido']}".strip(),
                                      "foto_perfil": u.get("imagen_url")}
                     for u in usuarios_res.data} if usuarios_res.data else {}

    for c in comentarios:
        info = usuarios_dict.get(c["id_usuario"], {"nombre_usuario": "Usuario", "foto_perfil": None})
        c["usuario_info"] = info
        if not c.get("foto_perfil"):
            c["foto_perfil"] = info["foto_perfil"]

    return jsonify(comentarios)

@app.route("/comentarios", methods=["POST"])
def crear_comentario():
    if "user_id" not in session:
        return jsonify({"error": "Usuario no autenticado"}), 401
    data = request.get_json()
    mensaje = data.get("mensaje", "").strip()
    if not mensaje:
        return jsonify({"error": "Mensaje requerido"}), 400

    res_usuario = supabase.table("usuarios").select("id_cliente,nombre,apellido,correo,imagen_url").eq("id_cliente", session["user_id"]).single().execute()
    user = res_usuario.data
    if not user:
        return jsonify({"error": "Usuario no encontrado"}), 404

    nuevo = supabase.table("comentarios").insert({
        "id_usuario": user["id_cliente"],
        "nombre_usuario": f"{user['nombre']} {user['apellido']}",
        "correo_usuario": user["correo"],
        "foto_perfil": user.get("imagen_url"),
        "mensaje": mensaje
    }).execute()
    return jsonify(nuevo.data[0])

@app.route("/comentarios/<id>", methods=["PUT"])
def editar_comentario(id):
    if "user_id" not in session:
        return jsonify({"error": "Usuario no autenticado"}), 401
    data = request.get_json()
    mensaje = data.get("mensaje", "").strip()
    if not mensaje:
        return jsonify({"error": "Mensaje requerido"}), 400

    comentario_res = supabase.table("comentarios").select("*").eq("id", id).single().execute()
    comentario = comentario_res.data
    if not comentario:
        return jsonify({"error": "Comentario no encontrado"}), 404

    if comentario["id_usuario"] != session["user_id"]:
        return jsonify({"error": "No puedes editar este comentario"}), 403

    actualizado = supabase.table("comentarios").update({"mensaje": mensaje}).eq("id", id).execute()
    return jsonify(actualizado.data[0])

@app.route("/comentarios/<id>", methods=["DELETE"])
def eliminar_comentario(id):
    if "user_id" not in session:
        return jsonify({"error": "Usuario no autenticado"}), 401

    comentario_res = supabase.table("comentarios").select("*").eq("id", id).single().execute()
    comentario = comentario_res.data
    if not comentario:
        return jsonify({"error": "Comentario no encontrado"}), 404

    if comentario["id_usuario"] != session["user_id"]:
        return jsonify({"error": "No puedes eliminar este comentario"}), 403

    supabase.table("comentarios").delete().eq("id", id).execute()
    return jsonify({"ok": True})

# APARTADO DE PEDIDOS

@app.route("/pedidos_page", methods=["GET"])
def pedidos_page():
    user_id = session.get("user_id")
    if not user_id:
        return redirect("/login")

    return render_template("pedidos.html")
    
@app.route("/obtener_pedidos", methods=["GET"])
def obtener_pedidos():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([]), 401

    pedidos_res = supabase.table("pedidos") \
        .select("*, usuarios(nombre,apellido,cedula,metodo_pago), gestion_productos(nombre,precio)") \
        .order("fecha_pedido", desc=True).execute()

    pedidos = pedidos_res.data or []
    for pedido in pedidos:
        producto = pedido.get("gestion_productos")
        pedido["nombre_producto"] = producto.get("nombre", "Postre") if producto else "Postre"
        pedido["precio_unitario"] = float(producto.get("precio", 0)) if producto else 0
        pedido["total"] = pedido.get("cantidad", 1) * pedido["precio_unitario"]

        usuario = pedido.get("usuarios", {})
        pedido["cliente"] = f"{usuario.get('nombre', 'Desconocido')} {usuario.get('apellido', '')}"
        pedido["cedula"] = usuario.get("cedula", "N/A")
        pedido["metodo_pago"] = usuario.get("metodo_pago", "Efectivo")

    print("[Pedidos] obtenidos")
    return jsonify(pedidos)

@app.route("/enviar_pedido", methods=["POST"])
def enviar_pedido():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"message": "Usuario no autenticado"}), 401

    data = request.get_json()
    id_producto = data.get("id_producto")
    cantidad = data.get("cantidad", 1)

    producto_res = supabase.table("gestion_productos").select("nombre, precio").eq("id_producto", id_producto).single().execute()
    if not producto_res.data:
        return jsonify({"message": "Producto no encontrado"}), 404

    producto = producto_res.data
    nombre_producto = producto["nombre"]
    precio_unitario = float(producto["precio"])
    total = cantidad * precio_unitario

    usuario_res = supabase.table("usuarios").select("nombre, apellido, direccion, metodo_pago").eq("id_cliente", user_id).single().execute()
    usuario = usuario_res.data or {}
    direccion = usuario.get("direccion", "")
    metodo_pago = usuario.get("metodo_pago", "Efectivo")

    pedido_res = supabase.table("pedidos").insert({
        "id_cliente": user_id,
        "id_producto": id_producto,
        "nombre_producto": nombre_producto,
        "cantidad": cantidad,
        "total": total,
        "direccion_entrega": direccion,
        "metodo_pago": metodo_pago,
        "estado": "Pendiente",
        "pagado": False
    }).execute()
    
    pedido = pedido_res.data[0]
    print(f"[Pedidos] Nuevo pedido enviado por usuario {user_id}: {pedido['id_pedido']}")
    return jsonify({
        "message": "Pedido enviado con éxito",
        "id_pedido": pedido["id_pedido"],
        "cliente": f"{usuario.get('nombre','Desconocido')} {usuario.get('apellido','')}",
        "nombre_producto": nombre_producto,
        "cantidad": cantidad,
        "total": total
    })

@app.route("/actualizar_estado/<uuid:id_pedido>", methods=["PUT"])
def actualizar_estado(id_pedido):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401

    data = request.get_json()
    nuevo_estado = data.get("estado")

    pedido = supabase.table("pedidos").select("*").eq("id_pedido", str(id_pedido)).single().execute().data
    if not pedido:
        return jsonify({"error": "Pedido no encontrado"}), 404

    supabase.table("pedidos").update({"estado": nuevo_estado}).eq("id_pedido", str(id_pedido)).execute()
    print(f"[Pedidos] Estado pedido {id_pedido} actualizado a {nuevo_estado}")
    return jsonify({"ok": True, "nuevo_estado": nuevo_estado})

@app.route("/actualizar_pago/<uuid:id_pedido>", methods=["PUT"])
def actualizar_pago(id_pedido):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401

    data = request.get_json()
    pagado = data.get("pagado")
    if pagado is None:
        return jsonify({"error": "Falta el valor de pago"}), 400

    pedido = supabase.table("pedidos").select("*").eq("id_pedido", str(id_pedido)).single().execute().data
    if not pedido:
        return jsonify({"error": "Pedido no encontrado"}), 404

    supabase.table("pedidos").update({"pagado": pagado}).eq("id_pedido", str(id_pedido)).execute()
    print(f"[Pedidos] Pago pedido {id_pedido} actualizado a {pagado}")
    return jsonify({"ok": True, "pagado": pagado})

@app.route("/eliminar_pedido/<uuid:id_pedido>", methods=["DELETE"])
def eliminar_pedido(id_pedido):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Usuario no autenticado"}), 401

    res = supabase.table("pedidos").delete().eq("id_pedido", str(id_pedido)).execute()
    if res.data is None:
        return jsonify({"success": False, "message": "No se eliminó el pedido"}), 400

    print(f"[Pedidos] Pedido {id_pedido} eliminado")
    return jsonify({"success": True, "message": "Pedido eliminado correctamente"})

# APP RUN

def get_local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip

@app.before_request
def redirect_root():
    if request.path == "/":
        return redirect("/inicio")

if __name__ == "__main__":
    host = "0.0.0.0"
    port = 8000
    local_ip = get_local_ip()

    debug_mode = False

    if debug_mode:
        print("⚡ Ejecutando en modo DEBUG con servidor de desarrollo de Flask")
        print(f"- Acceso local: http://localhost:{port}")
        print(f"- Acceso en red: http://{local_ip}:{port}")
        app.run(host=host, port=port, debug=True)
        
    else:
        print("🚀 Servidor ejecutándose en producción con Waitress")
        print(f"- Acceso local: http://localhost:{port}")
        print(f"- Acceso en red: http://{local_ip}:{port}")
        serve(app, host=host, port=port)
