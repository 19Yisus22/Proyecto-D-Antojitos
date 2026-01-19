from waitress import serve
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from flask import Flask, request, jsonify, render_template, session, redirect, url_for
import os, uuid, socket, secrets, logging, hashlib, websockets, cloudinary, cloudinary.uploader, json

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

def allowed_file(filename):
    ext = filename.rsplit(".", 1)[1].lower() if "." in filename else ""
    return ext in ALLOWED_EXTENSIONS

def upload_image_to_cloudinary(file, folder="mi_app", public_id=None):

    if not public_id:
        public_id = secrets.token_hex(8)
    result = cloudinary.uploader.upload(file, folder=folder, public_id=public_id, overwrite=True, resource_type="image")
    return result.get("secure_url")

def delete_image_from_cloudinary(public_url):

    parts = public_url.split("/")[-2:]
    public_id = "/".join(parts).split(".")[0]

    try:
        cloudinary.uploader.destroy(public_id, resource_type="image")
        return True
    
    except:
        return False

def hash_password(contrasena, salt=None):

    if not salt:
        salt = os.urandom(16).hex()
    hashed = hashlib.sha256((salt + contrasena).encode()).hexdigest()
    return f"{salt}${hashed}"

def verify_password(contrasena, hashed):
    salt, hash_val = hashed.split("$")
    return hashlib.sha256((salt + contrasena).encode()).hexdigest() == hash_val

def login_usuario(correo, contrasena):
    res = supabase.table("usuarios").select("*, roles(nombre_role), roles_permisos(permisos(nombre_permiso))").eq("correo", correo).execute()

    if not res.data:
        return None
    user = res.data[0]

    if not verify_password(contrasena, user["contrasena"]):
        return None
    return user

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

@app.route("/login", methods=["GET", "POST"])
def login():

    if request.method == "GET":
        return render_template("login.html")
    
    if not request.is_json:
        return jsonify({"ok": False, "error": "Content-Type application/json requerido"}), 415
    data = request.get_json()
    correo = data.get("correo", "").strip().lower()
    contrasena = data.get("contrasena", "")

    if not correo or not contrasena:
        return jsonify({"ok": False, "error": "Debes ingresar correo y contraseña"}), 400
    res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("correo", correo).execute()

    if not res.data:
        return jsonify({"ok": False, "error": "Correo o contraseña incorrectos"}), 401
    user = res.data[0]

    if not verify_password(contrasena, user["contrasena"]):
        return jsonify({"ok": False, "error": "Correo o contraseña incorrectos"}), 401
    permisos_res = supabase.table("roles_permisos").select("permisos(nombre_permiso)").eq("id_role", user["id_role"]).execute()
    permisos = [p["permisos"]["nombre_permiso"] for p in permisos_res.data if p.get("permisos")]
    session["user_id"] = user["id_cliente"]
    session["rol"] = user["roles"]["nombre_role"]
    session["permisos"] = permisos
    session["user"] = user 
    session["just_logged_in"] = True
    return jsonify({"ok": True, "redirect": "/inicio", "user": user, "permisos": permisos}), 200

@app.route("/inicio")
def inicio():

    user_id = session.get("user_id")

    if not user_id:
        session.clear()
        return render_template("inicio.html", user=None)
    res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", user_id).maybe_single().execute()

    if not res.data:
        session.clear()
        return render_template("inicio.html", user=None)
    user = res.data
    session["user"] = user
    just_logged_in = session.pop("just_logged_in", False)
    permisos_res = supabase.table("roles_permisos").select("permisos(nombre_permiso)").eq("id_role", user.get("id_role")).execute()
    user["permisos"] = [p["permisos"]["nombre_permiso"] for p in permisos_res.data if p.get("permisos")]
    pedidos_nuevos = False

    if user.get("roles", {}).get("nombre_role") == "admin":
        pedidos_res = supabase.table("pedidos").select("*").eq("estado", "nuevo").execute()
        pedidos_nuevos = bool(pedidos_res.data)
    return render_template("inicio.html", user=user, just_logged_in=just_logged_in, pedidos_nuevos=pedidos_nuevos)

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
        payload.get("contrasena", ""))
    
    if not all([cedula, nombre, apellido, correo, contrasena]):
        return jsonify({"ok": False, "error": "Todos los campos son obligatorios"}), 400
    hashed = hash_password(contrasena)
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
            "imagen_url": default_img}).execute()
        
        if not res.data:
            return jsonify({"ok": False, "error": "No se pudo registrar el usuario"}), 400
        return jsonify({"ok": True, "mensaje": "Usuario Registrado"}), 201
    
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400
    
@app.route("/logout")
def logout():

    session.clear()
    return redirect(url_for('index'))


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
        'metodo_pago': data.get('metodoPagoPerfil','').strip()}
    
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

    res = supabase.table("usuarios").select("id_cliente,imagen_url,cedula,nombre,apellido,telefono,correo,direccion,metodo_pago,fecha_creacion,roles(nombre_role)").execute()
    usuarios = res.data if res.data else []

    for u in usuarios:
        u["nombre_completo"] = f"{u.get('nombre','')} {u.get('apellido','')}".strip()
        u["rol"] = u.get("roles", {}).get("nombre_role") if u.get("roles") else None
    return jsonify(usuarios)

@app.route("/cambiar_contrasena", methods=["PUT"])
def cambiar_contrasena():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"ok": False, "error": "No autorizado"}), 401
    data = request.get_json()
    nueva = data.get("nueva", "").strip()

    if not nueva:
        return jsonify({"ok": False, "error": "Contraseña requerida"}), 400
    hashed = hash_password(nueva)
    supabase.table("usuarios").update({"contrasena": hashed}).eq("id_cliente", user_id).execute()
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


# APARTADO DE GESTION DE PRODUCTOS

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

        imagen_url = upload_image_to_cloudinary(f"data:image/png;base64,{foto_base64}", folder="productos") if foto_base64 else None

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
                else request.form[campo].strip())

    if "estado" in request.form:
        updates["estado"] = str(request.form["estado"]).lower() in ["true","1","on","sí","si"]
    foto_base64 = request.form.get("foto_base64")

    if foto_base64:
        res_producto = supabase.table("gestion_productos").select("*").eq("id_producto", id_producto).single().execute()
        producto_actual = res_producto.data

        if producto_actual and producto_actual.get("imagen_url"):
            delete_image_from_cloudinary(producto_actual["imagen_url"])
        updates["imagen_url"] = upload_image_to_cloudinary(f"data:image/png;base64,{foto_base64}", folder="productos")

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


# APARTADO DE CATALOGO

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
        insert_carrito = []

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
            
            insert_carrito.append({
                "id_cliente": user_id,
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": int(p["cantidad"]),
                "precio_unitario": precio_unitario,
                "total": precio_unitario * int(p["cantidad"])})
        supabase.table("carrito").insert(insert_carrito).execute()

        for p in insert_carrito:
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
            "imagen": prod.get("imagen_url") or "",
            "stock": int(prod.get("stock",0)),
            "agotado": int(prod.get("stock",0)) <= 0})
    return jsonify({"productos": carrito_completo})

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
        carrito_existente_res = supabase.table("carrito")\
            .select("*").eq("id_cliente", id_cliente)\
            .eq("id_producto", p["id_producto"]).single().execute()
        
        if carrito_existente_res.data:
            nueva_cantidad = int(carrito_existente_res.data.get("cantidad",1)) + cantidad
            supabase.table("carrito").update({
                "cantidad": nueva_cantidad,
                "total": nueva_cantidad * precio_unitario
            }).eq("id_carrito", carrito_existente_res.data["id_carrito"]).execute()

            carrito_response.append({
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": nueva_cantidad,
                "precio_unitario": precio_unitario,
                "total": nueva_cantidad * precio_unitario,
                "imagen_url": imagen_url})
            
        else:
            insert_data.append({
                "id_cliente": id_cliente,
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "total": cantidad * precio_unitario})

            carrito_response.append({
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": cantidad,
                "precio_unitario": precio_unitario,
                "total": cantidad * precio_unitario,
                "imagen_url": imagen_url})

    if insert_data:
        supabase.table("carrito").insert(insert_data).execute()
    return jsonify({"message": "Productos agregados al carrito correctamente", "carrito": carrito_response}), 200

@app.route("/carrito_quitar/<id_carrito>", methods=["DELETE"])
def carrito_quitar(id_carrito):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"ok": False, "message": "Debe iniciar sesión"}), 401
    
    carrito_item_res = supabase.table("carrito").select("*").eq("id_carrito", id_carrito).single().execute()
    item = carrito_item_res.data

    if item and item.get("id_cliente") == user_id:
        producto_id = item.get("id_producto")
        cantidad = item.get("cantidad", 0)
        producto_res = supabase.table("gestion_productos").select("stock").eq("id_producto", producto_id).single().execute()
        producto = producto_res.data

        if producto:
            nuevo_stock = producto.get("stock", 0) + cantidad
            supabase.table("gestion_productos").update({"stock": nuevo_stock}).eq("id_producto", producto_id).execute()
        supabase.table("carrito").delete().eq("id_carrito", id_carrito).execute()
        return jsonify({"ok": True, "message": "Producto eliminado del carrito y stock actualizado"})
    return jsonify({"ok": False, "message": "Producto no encontrado"}), 404

@app.route("/finalizar_compra", methods=["POST"])
def finalizar_compra():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"message": "Debe iniciar sesión"}), 401
    
    usuario_res = supabase.table("usuarios").select("nombre, apellido, cedula, direccion, metodo_pago, telefono, correo").eq("id_cliente", user_id).single().execute()
    usuario = usuario_res.data

    if not usuario or not usuario.get("direccion"):
        return jsonify({"message": "Usuario no tiene dirección registrada"}), 400
    carrito_res = supabase.table("carrito").select("*").eq("id_cliente", user_id).execute()
    carrito = carrito_res.data or []

    if not carrito:
        return jsonify({"message": "Carrito vacío"}), 400
    total_compra = 0
    detalles_carrito = []

    for item in carrito:
        prod_res = supabase.table("gestion_productos").select("precio").eq("id_producto", item["id_producto"]).single().execute()
        precio_unitario = float(item.get("precio_unitario") or prod_res.data.get("precio", 0))
        cantidad = int(item.get("cantidad", 1))
        subtotal_item = precio_unitario * cantidad
        total_compra += subtotal_item
        detalles_carrito.append({
            "id_producto": item.get("id_producto"),
            "nombre_producto": item.get("nombre_producto",""),
            "cantidad": cantidad,
            "precio_unitario": precio_unitario,
            "subtotal": subtotal_item})
        
    id_pedido = str(uuid.uuid4())

    supabase.table("pedidos").insert({
        "id_pedido": id_pedido,
        "id_cliente": user_id,
        "direccion_entrega": usuario["direccion"],
        "metodo_pago": usuario.get("metodo_pago","Efectivo"),
        "estado": "Pendiente",
        "pagado": False,
        "total": total_compra}).execute()
    
    for det in detalles_carrito:
        supabase.table("pedido_detalle").insert({
            "id_detalle": str(uuid.uuid4()),
            "id_pedido": id_pedido,
            "id_producto": det["id_producto"],
            "nombre_producto": det["nombre_producto"],
            "cantidad": det["cantidad"],
            "precio_unitario": det["precio_unitario"],
            "subtotal": det["subtotal"]}).execute()
        
    factura_res = supabase.table("facturas").insert({
        "id_factura": str(uuid.uuid4()),
        "id_pedido": id_pedido,
        "id_cliente": user_id,
        "subtotal": total_compra,
        "total": total_compra,
        "metodo_pago": usuario.get("metodo_pago","Efectivo"),
        "estado": "Emitida"}).execute()
    
    supabase.table("carrito").delete().eq("id_cliente", user_id).execute()

    return jsonify({
        "message": "Pedido enviado con éxito",
        "total": total_compra,
        "id_pedido": id_pedido,
        "productos": detalles_carrito,
        "metodo_pago": usuario.get("metodo_pago","Efectivo"),
        "nombre_cliente": f"{usuario.get('nombre','')} {usuario.get('apellido','')}",
        "cedula": usuario.get("cedula",""),
        "telefono": usuario.get("telefono",""),
        "correo": usuario.get("correo",""),
        "direccion_entrega": usuario.get("direccion","")})

@app.route("/buscar_facturas", methods=["GET"])
def buscar_facturas():

    cedula = request.args.get("cedula")

    if not cedula:
        return jsonify([]), 200
    usuario_res = supabase.table("usuarios").select("id_cliente, nombre, apellido, cedula, imagen_url, telefono, correo").eq("cedula", str(cedula)).limit(1).execute()

    if not usuario_res.data:
        return jsonify([]), 200
    usuario = usuario_res.data[0]
    id_cliente = usuario["id_cliente"]
    nombre_cliente = f"{usuario['nombre']} {usuario['apellido']}"
    facturas_res = supabase.table("facturas").select("*, pedidos(estado, pagado)").eq("id_cliente", id_cliente).order("fecha_emision", desc=True).execute()
    facturas = []

    for f in facturas_res.data:
        pedido = f.get("pedidos") or {}
        estado_pedido = pedido.get("estado")
        pagado = pedido.get("pagado")

        if estado_pedido == "Cancelado":
            estado_factura = "Anulada"

        elif estado_pedido == "Entregado" and pagado:
            estado_factura = "Pagada"

        else:
            estado_factura = "Emitida"
        detalles_res = supabase.table("pedido_detalle").select("*").eq("id_pedido", f["id_pedido"]).execute()
        detalles = detalles_res.data if detalles_res.data else []

        facturas.append({
            "id_factura": f["id_factura"],
            "numero_factura": f["numero_factura"],
            "fecha_emision": f["fecha_emision"],
            "subtotal": f["subtotal"],
            "total": f["total"],
            "metodo_pago": f["metodo_pago"],
            "estado": estado_factura,
            "nombre_cliente": nombre_cliente,
            "cedula": usuario["cedula"],
            "telefono": usuario.get("telefono"),
            "correo": usuario.get("correo"),
            "imagen_usuario": usuario.get("imagen_url"),
            "productos": detalles})
    facturas.sort(key=lambda x: x["fecha_emision"], reverse=True)
    return jsonify(facturas), 200

@app.route("/facturas/<uuid:id_factura>/anular", methods=["PUT"])
def anular_factura(id_factura):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"message": "Debe iniciar sesión"}), 401
    
    factura_res = supabase.table("facturas").select("id_pedido").eq("id_factura", str(id_factura)).limit(1).execute()

    if not factura_res.data:
        return jsonify({"message": "Factura no encontrada"}), 404
    id_pedido = factura_res.data[0]["id_pedido"]
    supabase.table("facturas").update({"estado": "Anulada"}).eq("id_factura", str(id_factura)).execute()
    supabase.table("pedidos").update({"estado": "Cancelado"}).eq("id_pedido", id_pedido).execute()
    return jsonify({"message": "Factura anulada"}), 200

@app.route("/actualizar_estado_factura/<id_factura>", methods=["PUT"])
def actualizar_estado_factura(id_factura):

    data = request.json
    nuevo_estado = data.get("estado")

    if nuevo_estado not in ["Emitida", "Anulada", "Pagada"]:
        return jsonify({"message": "Estado inválido"}), 400

    try:

        update_res = supabase.table("facturas").update({"estado": nuevo_estado}).eq("id_factura", id_factura).execute()

        if not update_res.data:
            return jsonify({"message": "Factura no encontrada"}), 404
        return jsonify({"message": "Estado actualizado correctamente", "factura": update_res.data[0]}), 200
    
    except Exception as e:
        return jsonify({"message": f"Error al actualizar: {str(e)}"}), 500

    
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
    
    pedidos_res = (
        supabase.table("pedidos")
        .select("""*, usuarios(id_cliente, nombre, apellido, cedula, metodo_pago, imagen_url), pedido_detalle(*, gestion_productos(nombre, precio, imagen_url))""")
        .order("fecha_pedido", desc=True)
        .execute()
    )

    pedidos = pedidos_res.data or []

    for p in pedidos:

        if p.get("estado") == "Pendiente":
            p["estado_factura"] = "Emitida"

        elif p.get("estado") == "Entregado" and p.get("pagado"):
            p["estado_factura"] = "Pagada"

        elif p.get("estado") == "Cancelado":
            p["estado_factura"] = "Anulada"

        else:
            p["estado_factura"] = "Emitida"
    return jsonify(pedidos)

@app.route("/enviar_pedido", methods=["POST"])
def enviar_pedido():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"message": "Usuario no autenticado"}), 401
    
    usuario_res = supabase.table("usuarios").select("nombre, apellido, direccion, metodo_pago").eq("id_cliente", user_id).single().execute()
    usuario = usuario_res.data or {}
    direccion = usuario.get("direccion", "")
    metodo_pago = usuario.get("metodo_pago", "Efectivo")
    carrito_res = supabase.table("carrito").select("id_producto, cantidad, precio_unitario, total, nombre_producto").eq("id_cliente", user_id).execute()
    carrito = carrito_res.data or []

    if not carrito:
        return jsonify({"message": "El carrito está vacío"}), 400
    total = sum(item["total"] for item in carrito)
    pedido_res = supabase.table("pedidos").insert({
        "id_cliente": user_id,
        "direccion_entrega": direccion,
        "metodo_pago": metodo_pago,
        "estado": "Pendiente",
        "pagado": False,
        "total": total}).execute()
    pedido = pedido_res.data[0]
    id_pedido = pedido["id_pedido"]

    detalles = [{
        "id_pedido": id_pedido,
        "id_producto": item["id_producto"],
        "nombre_producto": item["nombre_producto"],
        "cantidad": item["cantidad"],
        "precio_unitario": item["precio_unitario"],
        "subtotal": item["total"]} for item in carrito]

    supabase.table("pedido_detalle").insert(detalles).execute()
    supabase.table("carrito").delete().eq("id_cliente", user_id).execute()
    return jsonify({
        "message": "Pedido enviado con éxito",
        "id_pedido": id_pedido,
        "total": total})

@app.route("/actualizar_estado/<uuid:id_pedido>", methods=["PUT"])
def actualizar_estado(id_pedido):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401
    
    data = request.get_json()
    nuevo_estado = data.get("estado")
    pedido_res = supabase.table("pedidos").select("*").eq("id_pedido", str(id_pedido)).single().execute()
    pedido = pedido_res.data

    if not pedido:
        return jsonify({"error": "Pedido no encontrado"}), 404
    supabase.table("pedidos").update({"estado": nuevo_estado}).eq("id_pedido", str(id_pedido)).execute()
    estado_factura = "Emitida"

    if nuevo_estado == "Entregado" and pedido.get("pagado"):
        estado_factura = "Pagada"

    elif nuevo_estado == "Cancelado":
        estado_factura = "Anulada"
    return jsonify({"ok": True, "nuevo_estado": nuevo_estado, "estado_factura": estado_factura})

@app.route("/actualizar_pago/<uuid:id_pedido>", methods=["PUT"])
def actualizar_pago(id_pedido):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401
    
    data = request.get_json()
    pagado = data.get("pagado")

    if pagado is None:
        return jsonify({"error": "Falta el valor de pago"}), 400
    pedido_res = supabase.table("pedidos").select("*").eq("id_pedido", str(id_pedido)).single().execute()
    pedido = pedido_res.data

    if not pedido:
        return jsonify({"error": "Pedido no encontrado"}), 404
    supabase.table("pedidos").update({"pagado": pagado}).eq("id_pedido", str(id_pedido)).execute()
    estado_factura = "Emitida"

    if pedido.get("estado") == "Entregado" and pagado:
        estado_factura = "Pagada"

    elif pedido.get("estado") == "Cancelado":
        estado_factura = "Anulada"
    return jsonify({"ok": True, "pagado": pagado, "estado_factura": estado_factura})

@app.route("/eliminar_pedido/<uuid:id_pedido>", methods=["DELETE"])
def eliminar_pedido(id_pedido):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"success": False, "message": "Usuario no autenticado"}), 401
    
    res = supabase.table("pedidos").delete().eq("id_pedido", str(id_pedido)).execute()

    if res.data is None:
        return jsonify({"success": False, "message": "No se eliminó el pedido"}), 400
    return jsonify({"success": True, "message": "Pedido eliminado correctamente"})


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
    usuarios_dict = {u["id_cliente"]: {"nombre_usuario": f"{u['nombre']} {u['apellido']}".strip(), "foto_perfil": u.get("imagen_url")} for u in usuarios_res.data} if usuarios_res.data else {}

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
    usuarios_res = supabase.table("usuarios").select("id_cliente,nombre,apellido,imagen_url,telefono,correo").execute()
    usuarios_dict = {
        u["id_cliente"]: {
            "nombre_usuario": f"{u['nombre']} {u['apellido']}".strip(),
            "foto_perfil": u.get("imagen_url"),
            "telefono": u.get("telefono"),
            "correo": u.get("correo")
        }

        for u in usuarios_res.data

    } if usuarios_res.data else {}

    for c in comentarios:
        info = usuarios_dict.get(c["id_usuario"], {"nombre_usuario": "Usuario", "foto_perfil": None, "telefono": None, "correo": None})
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
        "mensaje": mensaje}).execute()
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


# APARTADO DE SISTEMA DE PUBLICIDAD

@app.route("/publicidad_page", methods=["GET", "POST"])
def publicidad_page():
    
    if request.method == "POST":
        subtitulo = request.form.get("subtitulo", "").strip()
        carrusel_data = json.loads(request.form.get("metadata_carrusel", "[]"))
        secciones_data = json.loads(request.form.get("metadata_secciones", "[]"))
        res_actual = supabase.table("publicidad").select("img").eq("tipo", "general").execute()
        urls_viejas = []

        if res_actual.data:
            img_data = res_actual.data[0].get("img", {})
            if isinstance(img_data, str): img_data = json.loads(img_data)
            for c in img_data.get("carrusel", []): 
                if c.get("url"): urls_viejas.append(c.get("url"))
            for s in img_data.get("secciones", []): 
                if s.get("url"): urls_viejas.append(s.get("url"))

        def procesar(metadata_list, file_key):

            files = request.files.getlist(file_key)
            file_idx = 0

            for item in metadata_list:
                if item.get("has_new") and file_idx < len(files):
                    if item.get("url"):
                        delete_image_from_cloudinary(item.get("url"))
                    f = files[file_idx]
                    if f:
                        item["url"] = upload_image_to_cloudinary(f, folder="publicidad_DAntojitos")
                    file_idx += 1
                if "has_new" in item: del item["has_new"]
            return metadata_list
        
        carrusel_final = procesar(carrusel_data, "imagenes_carrusel")
        secciones_final = procesar(secciones_data, "imagenes_secciones")
        urls_nuevas = [c["url"] for c in carrusel_final if c.get("url")] + [s["url"] for s in secciones_final if s.get("url")]
        
        for url in urls_viejas:
            if url and url not in urls_nuevas:
                delete_image_from_cloudinary(url)

        record = {
            "titulo": "Publicidad General",
            "subtitulo": subtitulo,
            "tipo": "general",
            "img": {"carrusel": carrusel_final, "secciones": secciones_final},
            "estado": True
        }

        resp = supabase.table("publicidad").select("id_publicidad").eq("tipo", "general").execute()

        if resp.data:
            supabase.table("publicidad").update(record).eq("id_publicidad", resp.data[0]["id_publicidad"]).execute()

        else:
            supabase.table("publicidad").insert(record).execute()
        return jsonify({"ok": True, "msg": "Publicidad actualizada"})

    res = supabase.table("publicidad").select("*").eq("tipo", "general").execute()
    publicidad = res.data[0] if res.data else {}
    return render_template("publicidad.html", publicidad=publicidad)

@app.route("/api/publicidad/activa", methods=["GET"])
def obtener_publicidad_activa():

    resp = supabase.table("publicidad").select("*").eq("tipo", "general").eq("estado", True).execute()

    if resp.data:
        pub = resp.data[0]
        imagenes = pub.get("img", {})

        if isinstance(imagenes, str): imagenes = json.loads(imagenes)
        return jsonify({
            "subtitulo": pub.get("subtitulo"),
            "metadata_carrusel": imagenes.get("carrusel", []),
            "metadata_secciones": imagenes.get("secciones", [])
        })
    
    return jsonify({})

@app.route("/api/admin/notificaciones", methods=["GET", "POST"])
def admin_notificaciones():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401
    
    if request.method == "POST":
        titulo = request.form.get("titulo")
        descripcion = request.form.get("descripcion")
        archivo = request.files.get("archivo")
        url = upload_image_to_cloudinary(archivo, folder="publicidad_DAntojitos") if archivo else ""
        record = {
            "titulo": "Publicidad",
            "titulo_publicidad": titulo,
            "tipo": "notificacion",
            "descripcion_publicidad": descripcion,
            "img": [url] if url else [],
            "estado": True
        }
        supabase.table("publicidad").insert(record).execute()
        return jsonify({"ok": True, "msg": "Creada"})

    resp = supabase.table("publicidad").select("*").eq("tipo", "notificacion").order("fecha_creacion", desc=True).execute()
    notificaciones = []

    for r in resp.data:

        imgs = r["img"]
        
        if isinstance(imgs, str): imgs = json.loads(imgs)
        notificaciones.append({
            "id_notificacion": r["id_publicidad"],
            "titulo": r["titulo_publicidad"],
            "descripcion": r["descripcion_publicidad"],
            "imagen_url": imgs[0] if imgs else ""})
    return jsonify(notificaciones)

@app.route("/api/admin/notificaciones/<id_notificacion>", methods=["PUT", "DELETE"])
def admin_gestion_notificacion(id_notificacion):

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401
    res = supabase.table("publicidad").select("img").eq("id_publicidad", id_notificacion).execute()
    url_actual = ""

    if res.data:

        imgs = res.data[0]["img"]

        if isinstance(imgs, str): imgs = json.loads(imgs)
        if imgs and isinstance(imgs, list): url_actual = imgs[0]

    if request.method == "DELETE":
        if url_actual: delete_image_from_cloudinary(url_actual)
        supabase.table("publicidad").delete().eq("id_publicidad", id_notificacion).execute()
        return jsonify({"ok": True})

    if request.method == "PUT":
        update_data = {
            "titulo_publicidad": request.form.get("titulo"),
            "descripcion_publicidad": request.form.get("descripcion")}
        archivo = request.files.get("archivo")

        if archivo:
            
            if url_actual: delete_image_from_cloudinary(url_actual)
            nueva_url = upload_image_to_cloudinary(archivo, folder="publicidad_DAntojitos")
            update_data["img"] = [nueva_url]
        supabase.table("publicidad").update(update_data).eq("id_publicidad", id_notificacion).execute()
        return jsonify({"ok": True})

@app.route("/api/admin/publicidad/eliminar_img", methods=["POST"])
def eliminar_imagen_suelta():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Usuario no autenticado"}), 401
    url = request.get_json().get("url")
    
    if url:
        delete_image_from_cloudinary(url)
        return jsonify({"ok": True})
    return jsonify({"ok": False}), 400

# APARTADO DEL APP RUN

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