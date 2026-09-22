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
if exist backend\api\main.py (
    cd /d "%~dp0backend"
    pip install fastapi uvicorn sqlalchemy python-multipart python-dotenv psycopg2-binary httpx
    cd /d "%~dp0"
) else if exist backend\main.py (
    cd /d "%~dp0backend"
    pip install fastapi uvicorn sqlalchemy python-multipart python-dotenv psycopg2-binary httpx
    cd /d "%~dp0"
) else (
    echo [ADVERTENCIA] No se encontro la app backend principal.
)

echo.
:: 2. INSTALAR DEPENDENCIAS DE NODE (FRONTEND)
echo [2/2] Instalando dependencias del Frontend (Node.js/React)...
if exist frontend\package.json (
    cd /d "%~dp0frontend"
    npm install
    cd /d "%~dp0"
) else if exist package.json (
    npm install
) else (
    echo [ADVERTENCIA] No se encontro package.json del frontend.
)

echo.
echo ========================================================
echo    ¡INSTALACION COMPLETADA CON EXITO!
echo ========================================================
echo Ya puedes ejecutar el sistema usando el archivo start.bat
echo.
pause