import requests
from waitress import serve
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client
from datetime import datetime, timezone, timedelta
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import os, uuid, socket, secrets, logging, hashlib, cloudinary, cloudinary.uploader, json
from flask import Flask, request, jsonify, render_template, session, redirect, url_for, make_response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
UPLOAD_DIR = os.path.join(STATIC_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True) 
env_path = os.path.join(BASE_DIR, ".env")

if os.path.exists(env_path):
    load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Faltan las credenciales de Supabase en el archivo .env")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")
CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_API_KEY or not CLOUDINARY_API_SECRET:
    raise ValueError("Faltan las credenciales de Cloudinary en el archivo .env")

cloudinary.config(cloud_name=CLOUDINARY_CLOUD_NAME, api_key=CLOUDINARY_API_KEY, api_secret=CLOUDINARY_API_SECRET)
FLASK_SECRET_KEY = os.getenv("FLASK_SECRET_KEY") or secrets.token_hex(24)
app = Flask(__name__, template_folder=TEMPLATES_DIR, static_folder=STATIC_DIR)
app.permanent_session_lifetime = timedelta(days=7)
app.secret_key = FLASK_SECRET_KEY
CORS(app, supports_credentials=True)
logging.getLogger('waitress').setLevel(logging.ERROR)

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
    try:
        salt, hash_val = hashed.split("$")
        return hashlib.sha256((salt + contrasena).encode()).hexdigest() == hash_val
    except:
        return False

@app.route("/obtener-cliente-id", methods=["GET"])
def obtener_cliente_id():
    cliente_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    return jsonify({"client_id": cliente_id})

@app.after_request
def agregar_cabeceras(response):
    response.headers['Cross-Origin-Opener-Policy'] = 'same-origin-allow-popups'
    response.headers['Cross-Origin-Resource-Policy'] = 'cross-origin'
    response.headers['Access-Control-Allow-Origin'] = '*'
    return response


# APARTADO DE AUTH

def verificar_token_google(token):
    try:
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            CLIENT_ID,
            clock_skew_in_seconds=60
        )
        return idinfo
    except ValueError as e:
        print(f"Error validando token: {e}")
        return None

@app.route("/registro-google", methods=["POST"])
def registro_google():
    token = request.form.get("credential")
    if not token:
        return redirect(url_for('login', error="No se recibió la credencial"))
        
    client_id_env = os.getenv("GOOGLE_CLIENT_ID")
    
    try:
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            client_id_env,
            clock_skew_in_seconds=60
        )
        
        correo = idinfo['email']
        ahora = datetime.now(timezone.utc).isoformat()
        
        res_user = supabase.table("usuarios").select("*, roles(nombre_role)").eq("correo", correo).maybe_single().execute()
        
        if res_user and res_user.data:
            user = res_user.data
            supabase.table("usuarios").update({"ultima_conexion": ahora}).eq("id_cliente", user["id_cliente"]).execute()
        else:
            nuevo_usuario = {
                "cedula": f"G-{uuid.uuid4().hex[:8]}",
                "nombre": idinfo.get('given_name', ''),
                "apellido": idinfo.get('family_name', ''),
                "correo": correo,
                "contrasena": "GOOGLE_AUTH_EXTERNAL",
                "metodo_pago": "Efectivo",
                "imagen_url": idinfo.get('picture', "static/uploads/default_icon_profile.png"),
                "telefono": "",
                "direccion": "",
                "ultima_conexion": ahora
            }
            res_insert = supabase.table("usuarios").insert(nuevo_usuario).execute()
            user_id = res_insert.data[0]["id_cliente"]
            res_full = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", user_id).maybe_single().execute()
            user = res_full.data
            
        session.permanent = True
        session["user_id"] = user["id_cliente"]
        session["user"] = user
        session["rol"] = user.get("roles", {}).get("nombre_role", "cliente")
        session["just_logged_in"] = True
        
        nombre = user.get("nombre", "Usuario")
        rol = session["rol"]
        
        return redirect(url_for('login', success_google="true", nombre=nombre, rol=rol))
        
    except Exception as e:
        return redirect(url_for('login', error=str(e)))

@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if "user_id" in session:
            return redirect("/inicio")
        return render_template("login.html")
    
    session.clear()
    data = request.get_json()
    correo = data.get("correo", "").strip().lower()
    
    try:
        res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("correo", correo).maybe_single().execute()
        
        if not res or not res.data or not verify_password(data.get("contrasena", ""), res.data["contrasena"]):
            return jsonify({"ok": False, "error": "Credenciales inválidas"}), 401
            
        user = res.data
        session.permanent = True
        session["user_id"] = user["id_cliente"]
        session["rol"] = user["roles"]["nombre_role"]
        session["user"] = user 
        session["just_logged_in"] = True
        
        ahora = datetime.now(timezone.utc).isoformat()
        supabase.table("usuarios").update({"ultima_conexion": ahora}).eq("id_cliente", user["id_cliente"]).execute()
        
        return jsonify({"ok": True, "redirect": "/inicio", "user": user}), 200
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.route("/registro", methods=["GET", "POST"])
def registro():
    if request.method == "GET":
        return render_template("registro.html")
    payload = request.get_json()
    correo = payload.get("correo", "").strip().lower()
    try:
        hashed = hash_password(payload.get("contrasena", ""))
        ahora = datetime.now(timezone.utc).isoformat()
        res = supabase.table("usuarios").insert({
            "cedula": payload.get("cedula", "").strip(),
            "nombre": payload.get("nombre", "").strip(),
            "apellido": payload.get("apellido", "").strip(),
            "telefono": payload.get("telefono", "").strip(),
            "correo": correo,
            "contrasena": hashed,
            "metodo_pago": "Efectivo",
            "imagen_url": "static/uploads/default_icon_profile.png",
            "ultima_conexion": ahora
        }).execute()
        return jsonify({"ok": True, "mensaje": "Usuario Registrado"}), 201
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

@app.route("/inicio")
def inicio():
    user_id = session.get("user_id")
    if not user_id:
        session.clear()
        return render_template("inicio.html", user=None)
    try:
        res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", user_id).maybe_single().execute()
        if not res or not res.data:
            session.clear()
            return render_template("inicio.html", user=None)
        user = res.data
        session["user"] = user
        just_logged_in = session.pop("just_logged_in", False)
        return render_template("inicio.html", user=user, just_logged_in=just_logged_in)
    except:
        return render_template("inicio.html", user=None)

@app.route("/logout")
def logout():
    user_id = session.get("user_id")
    if user_id:
        try:
            supabase.table("usuarios").update({"ultima_conexion": "2000-01-01T00:00:00Z"}).eq("id_cliente", user_id).execute()
        except:
            pass
    
    session.clear()
    response = make_response(redirect("/login"))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response


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
        'nombre': data.get('nombrePerfil', '').strip(),
        'apellido': data.get('apellidoPerfil', '').strip(),
        'telefono': data.get('telefonoPerfil', '').strip(),
        'correo': data.get('correoPerfil', '').strip().lower(),
        'direccion': data.get('direccionPerfil', '').strip(),
        'cedula': data.get('cedulaPerfil', '').strip(),
        'metodo_pago': data.get('metodoPagoPerfil', '').strip()
    }

    imagen_file = request.files.get("imagen_url")

    if imagen_file and imagen_file.filename:
        url_imagen = upload_image_to_cloudinary(imagen_file, folder="usuarios", public_id=f"foto_perfil_{id_cliente}")
        campos_actualizar["imagen_url"] = url_imagen

    campos_actualizar = {k: v for k, v in campos_actualizar.items() if v is not None and v != ""}

    if not campos_actualizar:
        return jsonify({"ok": False, "error": "No hay datos válidos para actualizar"}), 400

    try:
        supabase.table("usuarios").update(campos_actualizar).eq("id_cliente", id_cliente).execute()
        
        user_res = supabase.table("usuarios").select("*, roles(nombre_role)").eq("id_cliente", id_cliente).single().execute()
        usuario = user_res.data
        usuario["imagen_url"] = usuario.get("imagen_url") or "/static/default_icon_profile.png"
        
        return jsonify({"ok": True, "usuario": usuario})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

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

@app.route("/eliminar_usuario_admin", methods=["DELETE"])
def eliminar_usuario_admin():

    data = request.get_json()
    correo = data.get("correo", "").strip().lower()

    if not correo:
        return jsonify({"ok": False, "error": "Correo requerido"}), 400

    try:
        
        res_usuario = supabase.table("usuarios").select("*").eq("correo", correo).execute()

        if not res_usuario.data:
            return jsonify({"ok": False, "error": "Usuario no encontrado"}), 404
        usuario = res_usuario.data[0]

        if usuario.get("imagen_url") and "default_icon_profile.png" not in usuario["imagen_url"]:
            delete_image_from_cloudinary(usuario["imagen_url"])
        supabase.table("usuarios").delete().eq("correo", correo).execute()
        return jsonify({"ok": True})
    
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


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
            p["agotado"] = int(p.get("stock", 0)) <= 0
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
            "stock": int(p.get("stock", 0)),
            "imagen_url": p.get("imagen_url", ""),
            "categoria": p.get("categoria", "Postre"),
            "fecha": str(p.get("fecha_creacion", ""))}
            for p in productos]
            
        return jsonify({"productos": catalogo, "error": False})
    except Exception as e:
        return jsonify({"error": True, "message": str(e)}), 500

@app.route("/guardar_catalogo", methods=["POST"])
def guardar_catalogo():
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": True, "message": "Usuario no autenticado"}), 401
        
        data = request.json
        productos_solicitados = data.get("productos", [])

        if not productos_solicitados:
            return jsonify({"error": True, "message": "No hay productos para guardar"}), 400

        insert_carrito = []

        for p in productos_solicitados:
            prod_res = (
                supabase.table("gestion_productos")
                .select("nombre, stock, precio")
                .eq("id_producto", p["id_producto"])
                .single()
                .execute()
            )

            if not prod_res.data:
                return jsonify({"error": True, "message": f"Producto no existe"}), 400

            stock_actual = int(prod_res.data.get("stock", 0))
            nombre_producto = prod_res.data.get("nombre", "")
            precio_unitario = float(prod_res.data.get("precio", 0))
            cantidad_pedida = int(p["cantidad"])

            if stock_actual < cantidad_pedida:
                return jsonify({"error": True, "message": f"Stock insuficiente para {nombre_producto}"}), 400
            
            insert_carrito.append({
                "id_cliente": user_id,
                "id_producto": p["id_producto"],
                "nombre_producto": nombre_producto,
                "cantidad": cantidad_pedida,
                "precio_unitario": precio_unitario,
                "total": precio_unitario * cantidad_pedida
            })

        supabase.table("carrito").insert(insert_carrito).execute()

        for item in insert_carrito:
            res_stock = supabase.table("gestion_productos").select("stock").eq("id_producto", item["id_producto"]).single().execute()
            nuevo_stock = int(res_stock.data.get("stock", 0)) - item["cantidad"]
            supabase.table("gestion_productos").update({"stock": nuevo_stock}).eq("id_producto", item["id_producto"]).execute()

        return jsonify({"error": False, "message": "Productos agregados al carrito correctamente"}), 200
    except Exception as e:
        return jsonify({"error": True, "message": str(e)}), 500


# APARTADO DE CARRITO

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

    if not usuario:
        return jsonify({"message": "Usuario no encontrado"}), 404

    cedula_valor = str(usuario.get("cedula") or "").strip()
    direccion_valor = str(usuario.get("direccion") or "").strip()
    faltantes = []
    
    if not cedula_valor or cedula_valor.upper() == "N/A" or not cedula_valor.isdigit():
        faltantes.append("Cédula numérica válida")
        
    if not direccion_valor or direccion_valor.upper() == "N/A":
        faltantes.append("Dirección de entrega")

    if faltantes:
        msg = f"Datos requeridos: {' y '.join(faltantes)}"
        return jsonify({"message": msg, "completar_perfil": True}), 400

    carrito_res = supabase.table("carrito").select("*").eq("id_cliente", user_id).execute()
    carrito = carrito_res.data or []

    if not carrito:
        return jsonify({"message": "El carrito está vacío"}), 400

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
            "subtotal": subtotal_item
        })
        
    id_pedido = str(uuid.uuid4())
    supabase.table("pedidos").insert({
        "id_pedido": id_pedido,
        "id_cliente": user_id,
        "direccion_entrega": usuario["direccion"],
        "metodo_pago": usuario.get("metodo_pago","Efectivo"),
        "estado": "Pendiente",
        "pagado": False,
        "total": total_compra
    }).execute()
    
    for det in detalles_carrito:
        supabase.table("pedido_detalle").insert({
            "id_detalle": str(uuid.uuid4()),
            "id_pedido": id_pedido,
            "id_producto": det["id_producto"],
            "nombre_producto": det["nombre_producto"],
            "cantidad": det["cantidad"],
            "precio_unitario": det["precio_unitario"],
            "subtotal": det["subtotal"]
        }).execute()
        
    supabase.table("facturas").insert({
        "id_factura": str(uuid.uuid4()),
        "id_pedido": id_pedido,
        "id_cliente": user_id,
        "cedula": cedula_valor,
        "subtotal": total_compra,
        "total": total_compra,
        "metodo_pago": usuario.get("metodo_pago","Efectivo"),
        "estado": "Emitida"
    }).execute()

    supabase.table("carrito").delete().eq("id_cliente", user_id).execute()
    return jsonify({"message": "Pedido enviado con éxito", "ok": True})


# APARTADO DE FACTURAS

@app.route("/obtener_metodos_pago", methods=["GET"])
def obtener_metodos_pago():
    try:
        res = supabase.table("metodos_pago").select("*").eq("estado", True).execute()
        return jsonify({"metodos": res.data or []}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/buscar_facturas", methods=["GET"])
def buscar_facturas():
    cedula = request.args.get("cedula")
    if not cedula:
        return jsonify([]), 200

    try:
        usuario_res = supabase.table("usuarios").select("id_cliente, nombre, apellido, cedula, imagen_url, telefono, correo").eq("cedula", str(cedula)).limit(1).execute()

        if not usuario_res.data:
            return jsonify([]), 200

        usuario = usuario_res.data[0]
        id_cliente = usuario["id_cliente"]
        
        facturas_res = supabase.table("facturas").select("*").eq("id_cliente", id_cliente).order("fecha_emision", desc=True).execute()
        
        facturas = []
        for f in facturas_res.data:
            detalles_res = supabase.table("pedido_detalle").select("*").eq("id_pedido", f["id_pedido"]).execute()
            
            facturas.append({
                "id_factura": f["id_factura"],
                "numero_factura": f["numero_factura"],
                "fecha_emision": f["fecha_emision"],
                "subtotal": f["subtotal"],
                "total": f["total"],
                "metodo_pago": f["metodo_pago"],
                "estado": f["estado"],
                "usuarios": {
                    "nombre": usuario['nombre'],
                    "apellido": usuario['apellido'],
                    "cedula": usuario["cedula"],
                    "telefono": usuario.get("telefono"),
                    "correo": usuario.get("correo"),
                    "imagen_url": usuario.get("imagen_url")
                },
                "productos": detalles_res.data or []
            })

        return jsonify(facturas), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/facturas/<uuid:id_factura>/anular", methods=["PUT"])
def anular_factura(id_factura):
    try:
        factura_res = supabase.table("facturas").select("id_pedido").eq("id_factura", str(id_factura)).limit(1).execute()

        if not factura_res.data:
            return jsonify({"message": "Factura no encontrada"}), 404
            
        id_pedido = factura_res.data[0]["id_pedido"]
        
        supabase.table("facturas").update({"estado": "Anulada"}).eq("id_factura", str(id_factura)).execute()
        supabase.table("pedidos").update({"estado": "Cancelado"}).eq("id_pedido", id_pedido).execute()
        
        return jsonify({"message": "Factura anulada"}), 200
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@app.route("/actualizar_estado_factura/<id_factura>", methods=["PUT"])
def actualizar_estado_factura(id_factura):
    data = request.json
    nuevo_estado = data.get("estado")

    if nuevo_estado not in ["Emitida", "Anulada", "Pagada"]:
        return jsonify({"message": "Estado inválido"}), 400

    try:
        factura_res = supabase.table("facturas").select("id_pedido").eq("id_factura", str(id_factura)).limit(1).execute()
        
        if not factura_res.data:
            return jsonify({"message": "Factura no encontrada"}), 404
            
        id_pedido = factura_res.data[0]["id_pedido"]
        
        update_res = supabase.table("facturas").update({"estado": nuevo_estado}).eq("id_factura", str(id_factura)).execute()
        
        if nuevo_estado == "Pagada":
            supabase.table("pedidos").update({"pagado": True, "estado": "Finalizado"}).eq("id_pedido", id_pedido).execute()
        elif nuevo_estado == "Anulada":
            supabase.table("pedidos").update({"estado": "Cancelado"}).eq("id_pedido", id_pedido).execute()

        return jsonify({
            "message": "Estado actualizado correctamente", 
            "factura": update_res.data[0]
        }), 200
    
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
    
    query = "*, usuarios(id_cliente, nombre, apellido, cedula, telefono, correo, direccion, metodo_pago, imagen_url), pedido_detalle(*, gestion_productos(nombre, precio, imagen_url))"
    
    try:
        pedidos_res = (
            supabase.table("pedidos")
            .select(query)
            .order("fecha_pedido", desc=True)
            .execute()
        )
        pedidos = pedidos_res.data or []

        for p in pedidos:
            estado = p.get("estado")
            pagado = p.get("pagado")

            if estado == "Pendiente":
                p["estado_factura"] = "Emitida"
            elif estado == "Entregado" and pagado:
                p["estado_factura"] = "Pagada"
            elif estado == "Cancelado":
                p["estado_factura"] = "Anulada"
            else:
                p["estado_factura"] = "Emitida"
                
        return jsonify(pedidos), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

    supabase.table("facturas").update({"estado": estado_factura}).eq("id_pedido", str(id_pedido)).execute()

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

    update_pedido = supabase.table("pedidos").update({"pagado": bool(pagado)}).eq("id_pedido", str(id_pedido)).execute()
    if not update_pedido.data:
        return jsonify({"error": "No se pudo actualizar el pago"}), 500

    pedido = update_pedido.data[0]
    estado_factura = "Emitida"
    if pedido.get("estado") == "Entregado" and pagado:
        estado_factura = "Pagada"
    elif pedido.get("estado") == "Cancelado":
        estado_factura = "Anulada"

    supabase.table("facturas").update({"estado": estado_factura}).eq("id_pedido", str(id_pedido)).execute()

    return jsonify({"ok": True, "pagado": pagado, "estado_factura": estado_factura})

@app.route("/eliminar_pedidos", methods=["DELETE"])
def eliminar_pedidos():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Usuario no autenticado"}), 401

    data = request.get_json()
    ids = data.get("ids", [])

    if not ids:
        return jsonify({"success": False, "message": "No se seleccionaron elementos"}), 400

    res = supabase.table("pedidos").delete().in_("id_pedido", ids).execute()

    if not res.data:
        return jsonify({"success": False, "message": "No se pudo realizar la eliminación"}), 400

    return jsonify({"success": True, "message": "Eliminación exitosa"})


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
    try:
        comentarios_res = supabase.table("comentarios").select("*").order("created_at", desc=False).execute()
        comentarios = comentarios_res.data or []
        
        usuarios_res = supabase.table("usuarios").select("id_cliente,nombre,apellido,imagen_url,ultima_conexion").execute()
        usuarios_data = usuarios_res.data or []
        
        ahora = datetime.now(timezone.utc)
        usuarios_dict = {}
        
        for u in usuarios_data:
            esta_conectado = False
            ultima_con = u.get("ultima_conexion")
            if ultima_con:
                try:
                    fecha_con = datetime.fromisoformat(ultima_con.replace('Z', '+00:00'))
                    if (ahora - fecha_con).total_seconds() < 60:
                        esta_conectado = True
                except:
                    esta_conectado = False

            usuarios_dict[u["id_cliente"]] = {
                "nombre": u.get("nombre", ""),
                "apellido": u.get("apellido", ""),
                "foto_perfil": u.get("imagen_url"),
                "conectado": esta_conectado
            }

        for c in comentarios:
            c["usuario_info"] = usuarios_dict.get(c["id_usuario"], {
                "nombre": "Usuario", "apellido": "", "foto_perfil": None, "conectado": False
            })
            if c.get("likes_usuarios") is None:
                c["likes_usuarios"] = []

        return jsonify(comentarios)
    except Exception as e:
        print(f"Error en GET /comentarios: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/actualizar_estado_comentarios", methods=["POST"])
def actualizar_estado_comentarios():
    try:
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"status": "no_auth"}), 401
            
        ahora = datetime.now(timezone.utc).isoformat()
        supabase.table("usuarios").update({"ultima_conexion": ahora}).eq("id_cliente", user_id).execute()

        return jsonify({"status": "ok"}), 200
    except Exception as e:
        print(f"Error en actualizar_estado: {e}")
        return jsonify({"error": "server_error"}), 500

@app.route("/comentarios/<id>/like", methods=["POST"])
def toggle_like(id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "No auth"}), 401

    try:
        res = supabase.table("comentarios").select("likes_usuarios").eq("id", id).single().execute()
        if not res.data:
            return jsonify({"error": "No encontrado"}), 404
            
        likes = res.data.get("likes_usuarios")
        if not isinstance(likes, list):
            likes = []
        
        if user_id in likes:
            likes.remove(user_id)
        else:
            likes.append(user_id)

        supabase.table("comentarios").update({"likes_usuarios": likes}).eq("id", id).execute()
        return jsonify({"status": "ok", "likes": likes})
    except Exception as e:
        print(f"Error en Like: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/comentarios", methods=["POST"])
def crear_comentario():
    if "user_id" not in session:
        return jsonify({"error": "No auth"}), 401
    
    data = request.get_json()
    mensaje = data.get("mensaje", "").strip()
    if not mensaje:
        return jsonify({"error": "Vacio"}), 400

    res_user = supabase.table("usuarios").select("*").eq("id_cliente", session["user_id"]).single().execute()
    u = res_user.data

    nuevo = supabase.table("comentarios").insert({
        "id_usuario": u["id_cliente"],
        "nombre_usuario": f"{u['nombre']} {u['apellido']}",
        "correo_usuario": u["correo"],
        "foto_perfil": u.get("imagen_url"),
        "mensaje": mensaje,
        "likes_usuarios": []
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


# APARTADO DE SISTEMA DE PUBLICIDAD

@app.route("/publicidad_page", methods=["GET", "POST"])
def publicidad_page():

    if not session.get("user_id") or session.get("rol") != "admin":

        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.method == "POST":
            return jsonify({"error": "No autorizado"}), 401
        return render_template("publicidad.html")
        
    if request.method == "POST":

        try:
            tipos_a_gestionar = ["carrusel", "seccion", "cinta"]
            res_actual = supabase.table("publicidad").select("id_publicidad, imagen_url").in_("tipo", tipos_a_gestionar).execute()
            data_db = res_actual.data if res_actual.data else []
            viejos_urls = [row['imagen_url'] for row in data_db]
            ids_viejos = [row['id_publicidad'] for row in data_db]
            nuevos_registros = []
            urls_en_uso = []
            
            def procesar(metadata_key, file_key, tipo_db):
                metadata = json.loads(request.form.get(metadata_key, "[]"))
                files = request.files.getlist(file_key)
                f_idx = 0
                for item in metadata:
                    url_f = item.get("url_actual", "")
                    if item.get("cambio_img") and f_idx < len(files):
                        url_f = upload_image_to_cloudinary(files[f_idx], folder="publicidad")
                        f_idx += 1
                    
                    if url_f:
                        urls_en_uso.append(url_f)
                        nuevos_registros.append({
                            "tipo": tipo_db,
                            "titulo": item.get("titulo"),
                            "descripcion": item.get("descripcion", ""),
                            "imagen_url": url_f,
                            "estado": True
                        })

            procesar("metadata_carrusel", "imagenes_carrusel", "carrusel")
            procesar("metadata_secciones", "imagenes_secciones", "seccion")
            procesar("metadata_cinta", "imagenes_cinta", "cinta")

            if ids_viejos:
                supabase.table("publicidad").delete().in_("id_publicidad", ids_viejos).execute()
            
            if nuevos_registros:
                supabase.table("publicidad").insert(nuevos_registros).execute()

            for u in viejos_urls:
                if u not in urls_en_uso:
                    delete_image_from_cloudinary(u)
            return jsonify({"ok": True})
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return render_template("publicidad.html")

@app.route("/api/publicidad/activa", methods=["GET"])
def obtener_publicidad_activa():
    try:
        resp = supabase.table("publicidad").select("*").eq("estado", True).order("id_publicidad", desc=False).execute()
        return jsonify(resp.data if resp.data else [])
    except Exception as e:
        return jsonify([]), 500

@app.route("/api/admin/publicidad/delete/<id_publicidad>", methods=["DELETE"])
def delete_publicidad_individual(id_publicidad):
    if not session.get("user_id") or session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 401
    try:
        res = supabase.table("publicidad").select("imagen_url").eq("id_publicidad", id_publicidad).execute()
        if res.data:
            url = res.data[0].get("imagen_url")
            if url:
                delete_image_from_cloudinary(url)
            supabase.table("publicidad").delete().eq("id_publicidad", id_publicidad).execute()
            return jsonify({"ok": True})
        return jsonify({"error": "No encontrado"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/notificaciones", methods=["GET", "POST"])
def admin_notificaciones():
    if not session.get("user_id") or session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 401

    if request.method == "POST":
        try:
            titulo = request.form.get("titulo")
            descripcion = request.form.get("descripcion")
            archivo = request.files.get("archivo")
            url = upload_image_to_cloudinary(archivo, folder="publicidad_DAntojitos") if archivo else ""
            
            record = {
                "tipo": "notificacion",
                "titulo": titulo,
                "descripcion": descripcion,
                "imagen_url": url,
                "estado": True
            }
            supabase.table("publicidad").insert(record).execute()
            return jsonify({"ok": True, "msg": "Notificación creada"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    try:
        resp = supabase.table("publicidad").select("*").eq("tipo", "notificacion").order("id_publicidad", desc=True).execute()
        return jsonify(resp.data if resp.data else [])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/admin/notificaciones/<id_publicidad>", methods=["PUT", "DELETE"])
def admin_gestion_notificacion(id_publicidad):
    if not session.get("user_id") or session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 401

    try:
        res = supabase.table("publicidad").select("*").eq("id_publicidad", id_publicidad).execute()
        if not res.data:
            return jsonify({"error": "No encontrada"}), 404

        notificacion_actual = res.data[0]
        url_actual = notificacion_actual.get("imagen_url", "")

        if request.method == "DELETE":
            if url_actual:
                delete_image_from_cloudinary(url_actual)
            supabase.table("publicidad").delete().eq("id_publicidad", id_publicidad).execute()
            return jsonify({"ok": True})

        if request.method == "PUT":
            archivo = request.files.get("archivo")
            nueva_url = url_actual
            if archivo:
                if url_actual:
                    delete_image_from_cloudinary(url_actual)
                nueva_url = upload_image_to_cloudinary(archivo, folder="publicidad_DAntojitos")

            update_record = {
                "titulo": request.form.get("titulo", notificacion_actual.get("titulo")),
                "descripcion": request.form.get("descripcion", notificacion_actual.get("descripcion")),
                "imagen_url": nueva_url
            }
            supabase.table("publicidad").update(update_record).eq("id_publicidad", id_publicidad).execute()
            return jsonify({"ok": True})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# APARTADO DE ZONA DE PAGOS

@app.route("/facturacion_page", methods=["GET", "POST"])
def zona_pagos():
    if not session.get("user_id") or session.get("rol") != "admin":
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest' or request.method == "POST":
            return jsonify({"error": "No autorizado"}), 401
        return render_template("zona_pagos.html", metodos=[])
        
    if request.method == "POST":
        try:
            res_actual = supabase.table("metodos_pago").select("id_pago, qr_url").execute()
            data_db = res_actual.data if res_actual.data else []
            viejos_urls = [row['qr_url'] for row in data_db if row['qr_url']]
            ids_viejos = [row['id_pago'] for row in data_db]
            
            nuevos_registros = []
            urls_en_uso = []
            
            metadata = json.loads(request.form.get("metadata_pagos", "[]"))
            files = request.files.getlist("imagenes_qr")
            f_idx = 0
            
            for item in metadata:
                url_qr = item.get("url_actual", "")
                
                if item.get("cambio_img") and f_idx < len(files):
                    url_qr = upload_image_to_cloudinary(files[f_idx], folder="pagos_qr")
                    f_idx += 1
                
                nuevos_registros.append({
                    "entidad": item.get("entidad"),
                    "tipo_cuenta": item.get("tipo_cuenta"),
                    "numero": item.get("numero"),
                    "titular": item.get("titular"),
                    "qr_url": url_qr,
                    "estado": True
                })
                
                if url_qr:
                    urls_en_uso.append(url_qr)

            if ids_viejos:
                supabase.table("metodos_pago").delete().in_("id_pago", ids_viejos).execute()
            
            if nuevos_registros:
                supabase.table("metodos_pago").insert(nuevos_registros).execute()

            for u in viejos_urls:
                if u not in urls_en_uso:
                    delete_image_from_cloudinary(u)
                    
            return jsonify({"ok": True})
        
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    metodos_db = []
    try:
        res = supabase.table("metodos_pago").select("*").execute()
        metodos_db = res.data if res.data else []
    except Exception as e:
        metodos_db = []

    return render_template("zona_pagos.html", metodos=metodos_db)

@app.route("/actualizar_metodo_pago/<id_pago>", methods=["POST"])
def actualizar_metodo_pago(id_pago):
    if not session.get("user_id") or session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 401
    
    try:
        entidad = request.form.get("entidad")
        tipo_cuenta = request.form.get("tipo_cuenta")
        numero = request.form.get("numero")
        titular = request.form.get("titular")
        url_actual = request.form.get("url_actual")
        
        file_qr = request.files.get("imagen_qr")
        nueva_url_qr = url_actual

        if file_qr:
            if url_actual:
                delete_image_from_cloudinary(url_actual)
            nueva_url_qr = upload_image_to_cloudinary(file_qr, folder="pagos_qr")

        update_data = {
            "entidad": entidad,
            "tipo_cuenta": tipo_cuenta,
            "numero": numero,
            "titular": titular,
            "qr_url": nueva_url_qr
        }

        res = supabase.table("metodos_pago").update(update_data).eq("id_pago", id_pago).execute()
        return jsonify({"ok": True, "data": res.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/eliminar_metodo_pago/<id_pago>", methods=["DELETE"])
def eliminar_metodo_pago(id_pago):
    if not session.get("user_id") or session.get("rol") != "admin":
        return jsonify({"error": "No autorizado"}), 401
    
    try:
        res_pago = supabase.table("metodos_pago").select("qr_url").eq("id_pago", id_pago).single().execute()
        if res_pago.data and res_pago.data.get("qr_url"):
            delete_image_from_cloudinary(res_pago.data["qr_url"])
        
        supabase.table("metodos_pago").delete().eq("id_pago", id_pago).execute()
        return jsonify({"ok": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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

    debug_mode = True

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