# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker
import os

# --- NUEVA CONFIGURACIÓN DE RUTA ---
# Esto detecta exactamente en qué carpeta está main.py y busca la BD justo ahí
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "dataset_lsm_v1.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 1. Configuración de Base de Datos
SQLALCHEMY_DATABASE_URL = "sqlite:///dataset_lsm_v1.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Modelo de la tabla (igual al que usamos para poblar)
class Sena(Base):
    __tablename__ = 'senas'
    id_sena = Column(Integer, primary_key=True)
    nombre_sena = Column(String(150), nullable=False)
    url_youtube = Column(String(255), nullable=False)
    meta_muestras = Column(Integer)

# 2. Configuración de FastAPI
app = FastAPI(title="API Grabadora LSM")

# Permisos CORS para que React (Frontend) pueda conectarse
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # En producción se cambia por la URL de tu frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Tu primer Endpoint
@app.get("/api/senas")
def obtener_senas():
    db = SessionLocal()
    try:
        # Traemos todas las señas de la base de datos
        senas = db.query(Sena).all()
        return senas
    finally:
        db.close()