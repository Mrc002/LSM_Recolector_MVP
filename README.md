# LSM Recolector MVP

Aplicación para capturar, catalogar y visualizar muestras de lenguaje de señas mexicano (LSM) con una interfaz web orientada a la recolección de videos y métricas por seña.

## ¿Qué hace este proyecto?

La aplicación permite:

- seleccionar una seña del catálogo,
- grabar una muestra con la cámara,
- capturar landmarks y metadata de pose (ángulo horizontal, ángulo vertical y distancia),
- guardar el video y su registro en PostgreSQL,
- consultar un dashboard con progreso global y por seña.

El flujo activo actual es:

1. El usuario abre la pantalla de grabación.
2. La cámara se activa con MediaPipe Holistic.
3. El procesamiento se ejecuta en un Web Worker para reducir carga en el hilo principal.
4. Se envía el video y la metadata al backend.
5. El backend valida la seña, normaliza el usuario y almacena la muestra.
6. El dashboard consulta los datos desde PostgreSQL y muestra métricas por categoría y por seña.

## Stack real del proyecto

- Python 3.11+
- FastAPI
- SQLAlchemy
- PostgreSQL
- React
- Vite
- MediaPipe Holistic

## Estructura actual

```text
LSM_Recolector_MVP/
├── backend/
│   ├── api/
│   │   └── main.py                 # API FastAPI activa
│   ├── database/
│   │   └── schema.py               # Modelos SQLAlchemy y conexión PostgreSQL
│   ├── dataset/                    # Archivos generados por la app
│   ├── .env                        # Variables de entorno activas
│   ├── main.py                     # Archivo legacy no usado en el flujo principal
│   ├── storage_manager.py          # Guardado de video y archivos
│   └── ...
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   └── Grabadora.jsx      # Pantalla de captura y subida
│   │   └── workers/
│   │       └── holisticWorker.js  # Worker para MediaPipe Holistic
│   ├── package.json
│   ├── vite.config.js
│   └── ...
├── setup.bat
├── start.bat
├── docker-compose.yml
├── .gitignore
├── README.md
└── .env.example (si aplica según entorno local)
```

## Base de datos

La versión activa del proyecto usa PostgreSQL como base de datos principal.

La conexión actual se define en `backend/.env` con una variable tipo:

```env
DATABASE_URL=postgresql://postgres:admin@localhost:5432/postgres
```

SQLite y los artefactos legacy quedaron fuera del repositorio activo para evitar conflictos con la app real. La ruta de trabajo actual debe considerar PostgreSQL como la fuente de verdad.

## Requisitos previos

- Python instalado
- PostgreSQL corriendo en `localhost:5432`
- Node.js y npm
- Git

## Arranque rápido

### 1) Preparar el backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

Si la dependencia no tiene un `requirements.txt`, se puede instalar manualmente según el entorno local usado para FastAPI, SQLAlchemy y psycopg2.

### 2) Iniciar el frontend

```powershell
cd frontend
npm install
npm run dev -- --host 0.0.0.0
```

### 3) Ejecutar scripts del proyecto

```powershell
setup.bat
start.bat
```

## API principal

La API expone en la parte actual estos endpoints:

- `GET /api/senas`
- `GET /api/dashboard/global`
- `GET /api/dashboard/sena/{id_sena}`
- `POST /api/muestras`

Documentación automática de Swagger:

- http://localhost:8000/docs

## Dashboard y flujo de captura

El frontend incluye:

- selección de señas,
- visualización de cámara,
- detección de puntos clave con MediaPipe Holistic,
- overlay de landmarks en canvas,
- captura de video y envío al backend,
- dashboard con conteo y progreso por categoría/seña.

La lógica de extracción de landmarks se mueve a un Web Worker en:

- `frontend/src/workers/holisticWorker.js`

Esto permite mantener la interfaz más fluida y evitar saturar el hilo principal del navegador.

## Estado actual

Este proyecto ya quedó consolidado en una versión funcional con:

- backend FastAPI operativo,
- PostgreSQL como base de datos real,
- frontend Vite + React para grabación y dashboard,
- worker de MediaPipe para procesamiento de landmarks,
- legacy archivado fuera del repositorio activo.

## Nota de mantenimiento

Si se agregan más módulos o se vuelve a reorganizar la estructura, conviene mantener el flujo activo en `backend/api/main.py` y evitar duplicados que puedan causar conflictos con el runtime principal.
