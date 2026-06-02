@echo off
color 0A
echo ========================================================
echo      INSTALADOR DE DEPENDENCIAS - MVP LSM v1.0
echo ========================================================
echo.
echo Verificando requisitos del sistema...
echo.

:: 1. INSTALAR DEPENDENCIAS DE PYTHON (BACKEND)
echo [1/2] Instalando dependencias del Backend (Python)...
if exist main.py (
    pip install fastapi uvicorn sqlalchemy python-multipart
    echo Inicializando base de datos...
    python poblar_db.py
) else if exist backend\main.py (
    cd backend
    pip install fastapi uvicorn sqlalchemy python-multipart
    echo Inicializando base de datos...
    python poblar_db.py
    cd ..
) else (
    echo [ADVERTENCIA] No se encontro main.py. Asegurate de estar en la carpeta correcta.
)

echo.
:: 2. INSTALAR DEPENDENCIAS DE NODE (FRONTEND)
echo [2/2] Instalando dependencias del Frontend (Node.js/React)...
if exist package.json (
    npm install
    npm install react-router-dom
) else if exist frontend\package.json (
    cd frontend
    npm install
    npm install react-router-dom
    cd ..
) else (
    echo [ADVERTENCIA] No se encontro package.json.
)

echo.
echo ========================================================
echo    ¡INSTALACION COMPLETADA CON EXITO!
echo ========================================================
echo Ya puedes ejecutar el sistema usando el archivo start.bat
pause