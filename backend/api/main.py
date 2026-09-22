from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import sys
import os
import time
from datetime import datetime

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.schema import SessionLocal, Sena, Usuario, Muestra, Base, ConsentimientoInformado, engine
import storage_manager

app = FastAPI()

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)

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


def normalizar_id_usuario(value: str | None) -> str | None:
    if value is None:
        return None
    texto = str(value).strip()
    if texto == "" or texto.lower() == "anonimo":
        return None
    return texto


@app.get("/api/senas")
def obtener_senas(db: Session = Depends(get_db)):
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
            "muestras_actuales": total,
        }
        for sena, total in resultado
    ]


@app.get("/api/dashboard/global")
def obtener_dashboard_global(db: Session = Depends(get_db)):
    total_muestras = db.query(Muestra).count()
    total_senas_catalogo = db.query(Sena).count()
    total_donantes = db.query(Muestra.id_usuario).filter(Muestra.id_usuario.is_not(None)).distinct().count()

    categorias_db = db.query(Sena.categoria, func.count(Muestra.id_muestra)) \
        .outerjoin(Muestra, Sena.id_sena == Muestra.id_sena) \
        .group_by(Sena.categoria).all()

    distribucion_categorias = [
        {"categoria": categoria, "cantidad": cantidad}
        for categoria, cantidad in categorias_db
    ]

    return {
        "total_muestras": total_muestras,
        "total_senas": total_senas_catalogo,
        "total_donantes": total_donantes,
        "distribucion_categorias": distribucion_categorias,
    }


@app.get("/api/dashboard/sena/{id_sena}")
def obtener_expediente_sena(id_sena: int, db: Session = Depends(get_db)):
    sena = db.query(Sena).filter(Sena.id_sena == id_sena).first()
    if not sena:
        raise HTTPException(status_code=404, detail="Seña no encontrada")

    muestras = db.query(Muestra).filter(Muestra.id_sena == id_sena).all()
    total_recolectado = len(muestras)

    angulos_h = {"frontal": 0, "lateral_der": 0, "lateral_izq": 0}
    angulos_v = {"nivel_ojos": 0, "picado": 0, "contrapicado": 0}
    distancias = {"plano_medio": 0, "close_up": 0}

    for muestra in muestras:
        if muestra.angulo_horizontal in angulos_h:
            angulos_h[muestra.angulo_horizontal] += 1
        if muestra.angulo_vertical in angulos_v:
            angulos_v[muestra.angulo_vertical] += 1
        if muestra.distancia in distancias:
            distancias[muestra.distancia] += 1

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
            "distancia": distancias,
        },
    }


@app.post("/api/consentimiento")
def registrar_consentimiento(
    id_usuario: str = Form(...),
    acepta_consentimiento: bool = Form(...),
    nombre_participante: str | None = Form(None),
    correo: str | None = Form(None),
    version_documento: str = Form("v1"),
    db: Session = Depends(get_db),
):
    if not acepta_consentimiento:
        raise HTTPException(status_code=400, detail="Se requiere aceptar el consentimiento informado antes de recolectar datos biométricos.")

    usuario_normalizado = normalizar_id_usuario(id_usuario)
    if usuario_normalizado:
        usuario_existe = db.query(Usuario).filter(Usuario.id_usuario == usuario_normalizado).first()
        if not usuario_existe:
            db.add(Usuario(id_usuario=usuario_normalizado, fecha_registro=datetime.utcnow()))
            db.commit()

    consentimiento = ConsentimientoInformado(
        id_usuario=usuario_normalizado,
        nombre_participante=nombre_participante.strip() if nombre_participante else None,
        correo=correo.strip() if correo else None,
        acepta_consentimiento=True,
        version_documento=version_documento,
        fecha_consentimiento=datetime.utcnow(),
    )
    db.add(consentimiento)
    db.commit()
    db.refresh(consentimiento)

    return {
        "mensaje": "Consentimiento registrado correctamente.",
        "id_consentimiento": consentimiento.id_consentimiento,
        "acepta_consentimiento": True,
    }


@app.post("/api/muestras", status_code=201)
async def procesar_muestra(
    id_sena: int = Form(...),
    video: UploadFile = File(...),
    angulo_horizontal: str = Form("frontal"),
    angulo_vertical: str = Form("nivel_ojos"),
    distancia: str = Form("plano_medio"),
    id_usuario: str = Form("anonimo"),
    id_consentimiento: int | None = Form(None),
    db: Session = Depends(get_db),
):
    usuario_normalizado = normalizar_id_usuario(id_usuario)

    sena_db = db.query(Sena).filter(Sena.id_sena == id_sena).first()
    if not sena_db:
        raise HTTPException(status_code=404, detail="La seña no existe")

    if id_consentimiento is None:
        raise HTTPException(status_code=403, detail="Se requiere un consentimiento informado registrado antes de capturar video.")

    consentimiento = db.query(ConsentimientoInformado).filter(ConsentimientoInformado.id_consentimiento == id_consentimiento).first()
    if not consentimiento or not consentimiento.acepta_consentimiento:
        raise HTTPException(status_code=403, detail="El consentimiento informado no es válido o no fue autorizado.")

    if usuario_normalizado and consentimiento.id_usuario and consentimiento.id_usuario != usuario_normalizado:
        raise HTTPException(status_code=403, detail="El consentimiento no coincide con el usuario que intenta registrar la muestra.")

    if usuario_normalizado:
        donaciones_previas = db.query(Muestra).filter(
            Muestra.id_sena == id_sena,
            Muestra.id_usuario == usuario_normalizado,
        ).count()
        if donaciones_previas >= 5:
            raise HTTPException(status_code=403, detail="Límite de muestras alcanzado")

    ruta_video = None
    try:
        ruta_video, dir_final, nombre_video = await storage_manager.guardar_video(
            usuario_normalizado or "anonimo",
            sena_db,
            angulo_horizontal,
            angulo_vertical,
            distancia,
            video,
        )

        if usuario_normalizado:
            usuario_existe = db.query(Usuario).filter(Usuario.id_usuario == usuario_normalizado).first()
            if not usuario_existe:
                db.add(Usuario(id_usuario=usuario_normalizado, fecha_registro=datetime.utcnow()))
                db.commit()

        nueva_muestra = Muestra(
            id_sena=id_sena,
            id_usuario=usuario_normalizado,
            id_consentimiento=id_consentimiento,
            ruta_video=ruta_video,
            ruta_archivo=None,
            angulo_horizontal=angulo_horizontal,
            angulo_vertical=angulo_vertical,
            distancia=distancia,
            estado_revision="Pendiente",
            fecha_grabacion=datetime.utcnow(),
        )

        db.add(nueva_muestra)
        db.commit()
        db.refresh(nueva_muestra)

        return {
            "mensaje": "¡Video guardado con éxito!",
            "id_registro_db": nueva_muestra.id_muestra,
            "id_consentimiento": nueva_muestra.id_consentimiento,
            "archivo": nombre_video,
        }

    except Exception as e:
        db.rollback()
        if ruta_video:
            storage_manager.limpiar_archivos_huerfanos(ruta_video)
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")