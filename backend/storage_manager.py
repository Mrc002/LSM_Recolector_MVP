import os
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, "dataset")
VIDEOS_DIR = os.path.join(DATASET_DIR, "videos")

async def guardar_video(id_usuario, sena_db, angulo_horizontal, angulo_vertical, distancia, video_file):
    # Formateo seguro para carpetas
    cat_segura = sena_db.categoria.replace(" ", "_").replace("/", "-").lower()
    sena_segura = sena_db.nombre_sena.replace(" ", "_").lower()
    perspectiva_segura = f"{angulo_horizontal}_{angulo_vertical}_{distancia}".replace(" ", "_").lower()

    dir_video_final = os.path.join(VIDEOS_DIR, cat_segura, sena_segura, perspectiva_segura)
    os.makedirs(dir_video_final, exist_ok=True)

    timestamp = str(int(time.time() * 1000))
    nombre_base = f"user-{id_usuario}_sena-{sena_segura}_{perspectiva_segura}_{timestamp}"
    
    ruta_video = os.path.join(dir_video_final, f"{nombre_base}.webm")

    # Guardar únicamente el Video
    with open(ruta_video, "wb") as buffer:
        buffer.write(await video_file.read())

    return ruta_video, dir_video_final, f"{nombre_base}.webm"

def limpiar_archivos_huerfanos(ruta_video):
    if ruta_video and os.path.exists(ruta_video):
        os.remove(ruta_video)