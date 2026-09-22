import os
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime  # type: ignore[reportMissingImports]
# Importamos el tipo UUID nativo de PostgreSQL (con fallback a string)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID  # type: ignore[reportMissingImports]
from sqlalchemy.orm import declarative_base, sessionmaker, relationship  # type: ignore[reportMissingImports]
from datetime import datetime
from dotenv import load_dotenv

# 1. Cargar variables de entorno
load_dotenv()

# 2. Leer la URL de conexión desde el archivo .env
# Formato: postgresql://usuario:password@localhost:5432/nombre_bd
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

# 3. Crear el motor (eliminamos connect_args={"check_same_thread": False})
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# --- MODELOS ACTUALIZADOS ---
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
    # Cambiamos String por UUID de Postgres
    id_usuario = Column(PG_UUID(as_uuid=True), primary_key=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)
    muestras = relationship("Muestra", back_populates="usuario")

class Muestra(Base):
    __tablename__ = 'muestras'
    id_muestra = Column(Integer, primary_key=True, autoincrement=True)
    id_sena = Column(Integer, ForeignKey('senas.id_sena'))
    id_usuario = Column(PG_UUID(as_uuid=True), ForeignKey('usuarios.id_usuario'), nullable=True)
    
    ruta_video = Column(String(255), nullable=False) 
    ruta_archivo = Column(String(255), nullable=True) 
    
    angulo_horizontal = Column(String(50), nullable=True)
    angulo_vertical = Column(String(50), nullable=True)
    distancia = Column(String(50), nullable=True)
    estado_revision = Column(String(20), default='Pendiente')
    fecha_grabacion = Column(DateTime, default=datetime.utcnow)

    sena = relationship("Sena", back_populates="muestras")
    usuario = relationship("Usuario", back_populates="muestras")