from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
import sys
import os
import time
from datetime import datetime
from uuid import uuid4, UUID

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.schema import SessionLocal, Sena, Usuario, Muestra, Base, ConsentimientoInformado, engine
import storage_manager

app = FastAPI()

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1):(5173|5174|3000|8000)",
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
    if texto == "" or texto.lower() in {"anonimo", "null", "none"}:
        return None

    try:
        return str(UUID(texto))
    except (ValueError, TypeError):
        return None


def normalizar_correo(value: str | None) -> str | None:
    if value is None:
        return None
    texto = str(value).strip().lower()
    if texto == "":
        return None
    return texto


def resolver_usuario_por_identificador(value: str | None, db: Session) -> str | None:
    if value is None:
        return None

    texto = str(value).strip()
    if texto == "" or texto.lower() in {"anonimo", "null", "none"}:
        return None

    usuario_uuid = normalizar_id_usuario(texto)
    if usuario_uuid:
        return usuario_uuid

    correo_normalizado = normalizar_correo(texto)
    if correo_normalizado is None:
        return None

    consentimiento = db.query(ConsentimientoInformado).filter(
        func.lower(ConsentimientoInformado.correo) == correo_normalizado
    ).order_by(ConsentimientoInformado.fecha_consentimiento.desc()).first()

    if consentimiento and consentimiento.id_usuario is not None:
        return str(consentimiento.id_usuario)

    return None


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


@app.get("/api/progreso-usuario/{id_usuario}")
def obtener_progreso_usuario(id_usuario: str, id_sena: int | None = None, db: Session = Depends(get_db)):
    usuario_normalizado = resolver_usuario_por_identificador(id_usuario, db)

    total_donaciones = 0
    if usuario_normalizado:
        total_donaciones = db.query(Muestra).filter(Muestra.id_usuario == usuario_normalizado).count()

    limite_total = 20
    faltan_total = max(0, limite_total - total_donaciones)
    porcentaje_total = min(100, round((total_donaciones / limite_total) * 100, 1)) if limite_total else 0

    caso_actual = 0
    if usuario_normalizado and id_sena is not None:
        caso_actual = db.query(Muestra).filter(
            Muestra.id_usuario == usuario_normalizado,
            Muestra.id_sena == id_sena,
        ).count()

    limite_caso = 20
    faltan_caso = max(0, limite_caso - caso_actual)
    porcentaje_caso = min(100, round((caso_actual / limite_caso) * 100, 1)) if limite_caso else 0

    casos = {
        "frontal": {"actual": 0, "limite": 5, "faltan": 5, "porcentaje": 0},
        "lateral_der": {"actual": 0, "limite": 5, "faltan": 5, "porcentaje": 0},
        "lateral_izq": {"actual": 0, "limite": 5, "faltan": 5, "porcentaje": 0},
        "close_up": {"actual": 0, "limite": 5, "faltan": 5, "porcentaje": 0},
    }

    if usuario_normalizado and id_sena is not None:
        for nombre_caso in casos.keys():
            filtro = Muestra.id_usuario == usuario_normalizado
            filtro = filtro & (Muestra.id_sena == id_sena)
            if nombre_caso == "close_up":
                filtro = filtro & (Muestra.distancia == "close_up")
            else:
                filtro = filtro & (Muestra.angulo_horizontal == nombre_caso)

            actual = db.query(Muestra).filter(filtro).count()
            casos[nombre_caso]["actual"] = actual
            casos[nombre_caso]["faltan"] = max(0, 5 - actual)
            casos[nombre_caso]["porcentaje"] = min(100, round((actual / 5) * 100, 1)) if 5 else 0

    return {
        "usuario": usuario_normalizado or "anonimo",
        "total_donaciones": total_donaciones,
        "limite_total": limite_total,
        "faltan_total": faltan_total,
        "porcentaje_total": porcentaje_total,
        "caso_actual": caso_actual,
        "limite_caso": limite_caso,
        "faltan_caso": faltan_caso,
        "porcentaje_caso": porcentaje_caso,
        "casos": casos,
        "bloqueado": total_donaciones >= limite_total or any(item['actual'] >= item['limite'] for item in casos.values()),
        "id_sena_actual": id_sena,
    }


@app.post("/api/consentimiento")
def registrar_consentimiento(
    id_usuario: str = Form("anonimo"),
    acepta_consentimiento: bool = Form(...),
    nombre_participante: str | None = Form(None),
    correo: str | None = Form(None),
    version_documento: str = Form("v1"),
    db: Session = Depends(get_db),
):
    if not acepta_consentimiento:
        raise HTTPException(status_code=400, detail="Se requiere aceptar el consentimiento informado antes de recolectar datos biométricos.")

    nombre = (nombre_participante or "").strip()
    correo_normalizado = normalizar_correo(correo)
    if not nombre:
        raise HTTPException(status_code=400, detail="El nombre completo del participante es obligatorio.")
    if not correo_normalizado:
        raise HTTPException(status_code=400, detail="El correo electrónico es obligatorio para registrar la trazabilidad del participante.")

    consentimiento_existente = db.query(ConsentimientoInformado).filter(
        func.lower(ConsentimientoInformado.correo) == correo_normalizado
    ).order_by(ConsentimientoInformado.fecha_consentimiento.desc()).first()

    if consentimiento_existente and consentimiento_existente.acepta_consentimiento:
        usuario = consentimiento_existente.usuario
        if usuario is None:
            usuario = Usuario(id_usuario=str(uuid4()), fecha_registro=datetime.utcnow())
            db.add(usuario)
            db.commit()
            db.refresh(usuario)
            consentimiento_existente.id_usuario = usuario.id_usuario
            db.commit()
        return {
            "mensaje": "Consentimiento ya registrado para este correo.",
            "id_usuario": str(usuario.id_usuario),
            "id_consentimiento": consentimiento_existente.id_consentimiento,
            "acepta_consentimiento": True,
        }

    usuario_normalizado = normalizar_id_usuario(id_usuario)
    if usuario_normalizado:
        usuario_existe = db.query(Usuario).filter(Usuario.id_usuario == usuario_normalizado).first()
        if not usuario_existe:
            db.add(Usuario(id_usuario=usuario_normalizado, fecha_registro=datetime.utcnow()))
            db.commit()
    else:
        usuario_existe = Usuario(id_usuario=str(uuid4()), fecha_registro=datetime.utcnow())
        db.add(usuario_existe)
        db.commit()
        db.refresh(usuario_existe)

    consentimiento = ConsentimientoInformado(
        id_usuario=usuario_existe.id_usuario,
        nombre_participante=nombre,
        correo=correo_normalizado,
        acepta_consentimiento=True,
        version_documento=version_documento,
        fecha_consentimiento=datetime.utcnow(),
    )
    db.add(consentimiento)
    db.commit()
    db.refresh(consentimiento)

    return {
        "mensaje": "Consentimiento registrado correctamente.",
        "id_usuario": str(usuario_existe.id_usuario),
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
    id_consentimiento: str | None = Form(None),
    db: Session = Depends(get_db),
):
    usuario_normalizado = normalizar_id_usuario(id_usuario)

    raw_consentimiento = (id_consentimiento or "").strip()
    if raw_consentimiento in {"", "null", "none"}:
        consentimiento_id = None
    else:
        try:
            consentimiento_id = int(raw_consentimiento)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="El identificador del consentimiento es inválido.") from exc

    sena_db = db.query(Sena).filter(Sena.id_sena == id_sena).first()
    if not sena_db:
        raise HTTPException(status_code=404, detail="La seña no existe")

    if consentimiento_id is None:
        raise HTTPException(status_code=403, detail="Se requiere un consentimiento informado registrado antes de capturar video.")

    consentimiento = db.query(ConsentimientoInformado).filter(ConsentimientoInformado.id_consentimiento == consentimiento_id).first()
    if not consentimiento or not consentimiento.acepta_consentimiento:
        raise HTTPException(status_code=403, detail="El consentimiento informado no es válido o no fue autorizado.")

    if usuario_normalizado is None and consentimiento.id_usuario is not None:
        usuario_normalizado = str(consentimiento.id_usuario)

    if usuario_normalizado and consentimiento.id_usuario and str(consentimiento.id_usuario) != usuario_normalizado:
        raise HTTPException(status_code=403, detail="El consentimiento no coincide con el usuario que intenta registrar la muestra.")

    if usuario_normalizado:
        total_previas = db.query(Muestra).filter(
            Muestra.id_usuario == usuario_normalizado,
        ).count()
        if total_previas >= 20:
            raise HTTPException(status_code=403, detail="Límite general de 20 donaciones por participante alcanzado.")

        caso_actual = db.query(Muestra).filter(
            Muestra.id_usuario == usuario_normalizado,
            Muestra.angulo_horizontal == angulo_horizontal,
        ).count()
        if angulo_horizontal == "frontal" and caso_actual >= 5:
            raise HTTPException(status_code=403, detail="Límite alcanzado para la pose frontal: 5 donaciones por caso.")
        if angulo_horizontal == "lateral_der" and caso_actual >= 5:
            raise HTTPException(status_code=403, detail="Límite alcanzado para la pose lateral derecha: 5 donaciones por caso.")
        if angulo_horizontal == "lateral_izq" and caso_actual >= 5:
            raise HTTPException(status_code=403, detail="Límite alcanzado para la pose lateral izquierda: 5 donaciones por caso.")
        if distancia == "close_up" and db.query(Muestra).filter(
            Muestra.id_usuario == usuario_normalizado,
            Muestra.distancia == "close_up",
        ).count() >= 5:
            raise HTTPException(status_code=403, detail="Límite alcanzado para el caso close-up: 5 donaciones por caso.")

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
            id_consentimiento=consentimiento_id,
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