from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
import os
import time
from datetime import datetime
from sqlalchemy import func

# --- RUTAS DE CARPETAS RAÍZ ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "dataset_lsm_v1.db")
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
VIDEOS_DIR = os.path.join(DATASET_DIR, "videos")
VECTORES_DIR = os.path.join(DATASET_DIR, "vectores")

SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==========================================
# MODELOS DE LA BASE DE DATOS
# ==========================================
class Sena(Base):
    __tablename__ = 'senas'
    id_sena = Column(Integer, primary_key=True)
    nombre_sena = Column(String(150), nullable=False, unique=True)
    categoria = Column(String(100), nullable=False)
    url_youtube = Column(String(255), nullable=False)
    meta_muestras = Column(Integer, default=500)
    muestras = relationship("Muestra", back_populates="sena")

class Usuario(Base):
    __tablename__ = 'usuarios'
    id_usuario = Column(String(50), primary_key=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    muestras = relationship("Muestra", back_populates="usuario")

class Muestra(Base):
    __tablename__ = 'muestras'
    id_muestra = Column(Integer, primary_key=True, autoincrement=True)
    id_sena = Column(Integer, ForeignKey('senas.id_sena'))
    id_usuario = Column(String(50), ForeignKey('usuarios.id_usuario'), nullable=True)
    
    ruta_video = Column(String(255), nullable=False)
    ruta_json = Column(String(255), nullable=False)
    
    angulo_horizontal = Column(String(50), nullable=True)
    angulo_vertical = Column(String(50), nullable=True)
    distancia = Column(String(50), nullable=True)
    
    estado_revision = Column(String(20), default='Pendiente')
    fecha_grabacion = Column(DateTime, default=datetime.utcnow)

    sena = relationship("Sena", back_populates="muestras")
    usuario = relationship("Usuario", back_populates="muestras")

# Iniciar la app FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ==========================================
# CONSTANTES DE REGLAS DE NEGOCIO
# ==========================================
LIMITE_POR_USUARIO = 5

# ==========================================
# ENDPOINT 1: OBTENER LISTA DE SEÑAS
# ==========================================
@app.get("/api/senas")
def obtener_senas(db: Session = Depends(get_db)):
    # Hacemos una consulta avanzada: Traemos la seña y contamos cuántas muestras tiene
    resultado = db.query(
        Sena, 
        func.count(Muestra.id_muestra).label("total_muestras")
    ).outerjoin(Muestra, Sena.id_sena == Muestra.id_sena).group_by(Sena.id_sena).all()
    
    return [
        {
            "id_sena": sena.id_sena, 
            "nombre_sena": sena.nombre_sena, 
            "categoria": sena.categoria, 
            "url_youtube": sena.url_youtube,
            "meta_muestras": sena.meta_muestras,
            "muestras_actuales": total
        } 
        for sena, total in resultado
    ]


# ==========================================
# ENDPOINT 2: RECIBIR Y GUARDAR MUESTRAS
# ==========================================
@app.post("/api/muestras")
async def guardar_muestra(
    id_sena: int = Form(...),
    video: UploadFile = File(...),
    vectores: UploadFile = File(...),
    
    # Recibimos los selectores de React, con valores por defecto si olvidan mandarlos
    angulo_horizontal: str = Form("frontal"),
    angulo_vertical: str = Form("nivel_ojos"),
    distancia: str = Form("plano_medio"),
    id_usuario: str = Form("anonimo"), # En el futuro, React mandará el ID de quien inició sesión
    
    db: Session = Depends(get_db)
):
    try:
        # 1. Validar que la seña exista para poder extraer su categoría y nombre
        sena_db = db.query(Sena).filter(Sena.id_sena == id_sena).first()
        if not sena_db:
            raise HTTPException(status_code=404, detail="La seña no existe en la base de datos")

        # 2. 🛡️ REGLA ANTISPAM: Limitar donaciones del mismo usuario (si no es anónimo)
        if id_usuario and id_usuario != "anonimo":
            donaciones_previas = db.query(Muestra).filter(Muestra.id_sena == id_sena, Muestra.id_usuario == id_usuario).count()
            if donaciones_previas >= LIMITE_POR_USUARIO:
                raise HTTPException(status_code=403, detail=f"El usuario {id_usuario} ya alcanzó el límite de {LIMITE_POR_USUARIO} muestras permitidas para la seña '{sena_db.nombre_sena}'.")

        # 3. Formatear y limpiar textos para que sean nombres de carpeta válidos
        # Evita errores en Windows/Linux al quitar espacios y convertirlos a minúsculas
        cat_segura = sena_db.categoria.replace(" ", "_").replace("/", "-").lower()
        sena_segura = sena_db.nombre_sena.replace(" ", "_").lower()
        perspectiva_segura = f"{angulo_horizontal}_{angulo_vertical}_{distancia}".replace(" ", "_").lower()

        # 4. Crear las rutas anidadas dinámicamente
        # Ejemplo: /dataset/videos/verbos/comer/frontal_nivel_ojos_plano_medio/
        dir_video_final = os.path.join(VIDEOS_DIR, cat_segura, sena_segura, perspectiva_segura)
        dir_vector_final = os.path.join(VECTORES_DIR, cat_segura, sena_segura, perspectiva_segura)
        
        os.makedirs(dir_video_final, exist_ok=True)
        os.makedirs(dir_vector_final, exist_ok=True)

        # 5. Serializar el nombre del archivo (con marca de tiempo para evitar sobreescritura accidental)
        timestamp = str(int(time.time() * 1000))
        # Ejemplo: u123_comer_frontal_nivel_ojos_plano_medio_1780270820545.webm
        nombre_base = f"user-{id_usuario}_sena-{sena_segura}_{perspectiva_segura}_{timestamp}"
        
        ruta_video = os.path.join(dir_video_final, f"{nombre_base}.webm")
        ruta_json = os.path.join(dir_vector_final, f"{nombre_base}.json")

        # 6. Guardar archivos físicamente en su jerarquía
        with open(ruta_video, "wb") as buffer:
            buffer.write(await video.read())
            
        with open(ruta_json, "wb") as buffer:
            buffer.write(await vectores.read())

        # 7. Registrar en la base de datos (El Índice)
        # Si el usuario no existe en la tabla de usuarios, lo creamos rápido para respetar la llave foránea
        if id_usuario != "anonimo":
            usuario_existe = db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()
            if not usuario_existe:
                db.add(Usuario(id_usuario=id_usuario))
                db.commit()

        nueva_muestra = Muestra(
            id_sena=id_sena,
            id_usuario=id_usuario,
            ruta_video=ruta_video,
            ruta_json=ruta_json,
            angulo_horizontal=angulo_horizontal,
            angulo_vertical=angulo_vertical,
            distancia=distancia
        )
        
        db.add(nueva_muestra)
        db.commit()
        db.refresh(nueva_muestra)

        return {
            "mensaje": "¡Muestra guardada con éxito!",
            "id_registro_db": nueva_muestra.id_muestra,
            "carpeta": dir_video_final,
            "archivo": f"{nombre_base}.webm"
        }

    except HTTPException as e:
        # Relanzar el error HTTP directamente para que React lo atrape
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# ==========================================
# ENDPOINT 3: DASHBOARD GLOBAL
# ==========================================
@app.get("/api/dashboard/global")
def obtener_dashboard_global(db: Session = Depends(get_db)):
    total_muestras = db.query(Muestra).count()
    total_senas_catalogo = db.query(Sena).count()
    
    # Contar usuarios únicos (ignorando los anónimos para una métrica más estricta si lo deseas, o incluyéndolos)
    total_donantes = db.query(Muestra.id_usuario).distinct().count()
    
    # Muestras por categoría
    categorias_db = db.query(Sena.categoria, func.count(Muestra.id_muestra))\
                      .outerjoin(Muestra, Sena.id_sena == Muestra.id_sena)\
                      .group_by(Sena.categoria).all()
                      
    distribucion_categorias = [{"categoria": cat, "cantidad": cant} for cat, cant in categorias_db]

    return {
        "total_muestras": total_muestras,
        "total_senas": total_senas_catalogo,
        "total_donantes": total_donantes,
        "distribucion_categorias": distribucion_categorias
    }

# ==========================================
# ENDPOINT 4: EXPEDIENTE INDIVIDUAL DE SEÑA
# ==========================================
@app.get("/api/dashboard/sena/{id_sena}")
def obtener_expediente_sena(id_sena: int, db: Session = Depends(get_db)):
    sena = db.query(Sena).filter(Sena.id_sena == id_sena).first()
    if not sena:
        raise HTTPException(status_code=404, detail="Seña no encontrada")

    muestras = db.query(Muestra).filter(Muestra.id_sena == id_sena).all()
    total_recolectado = len(muestras)
    
    # Contadores de métricas
    angulos_h = {"frontal": 0, "lateral_der": 0, "lateral_izq": 0}
    angulos_v = {"nivel_ojos": 0, "picado": 0, "contrapicado": 0}
    distancias = {"plano_medio": 0, "close_up": 0}
    
    for m in muestras:
        if m.angulo_horizontal in angulos_h: angulos_h[m.angulo_horizontal] += 1
        if m.angulo_vertical in angulos_v: angulos_v[m.angulo_vertical] += 1
        if m.distancia in distancias: distancias[m.distancia] += 1

    return {
        "id_sena": sena.id_sena,
        "nombre_sena": sena.nombre_sena,
        "categoria": sena.categoria,
        "meta": sena.meta_muestras,
        "progreso_actual": total_recolectado,
        "porcentaje_completado": round((total_recolectado / sena.meta_muestras) * 100, 1) if sena.meta_muestras > 0 else 0,
        "metricas": {
            "angulo_horizontal": angulos_h,
            "angulo_vertical": angulos_v,
            "distancia": distancias
        }
    }