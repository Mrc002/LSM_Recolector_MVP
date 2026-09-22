@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo      INSTALADOR DE DEPENDENCIAS - MVP LSM v1.0
echo ========================================================
echo.
echo Verificando requisitos del sistema...
echo.

where python >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Python no encontrado. Instala Python antes de continuar.
    pause
    exit /b 1
)

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js no encontrado. Instala Node.js antes de continuar.
    pause
    exit /b 1
)

echo [1/2] Instalando dependencias del Backend (Python)...
if exist backend\api\main.py (
    cd /d "%~dp0backend"
    python -m pip install --upgrade pip
    python -m pip install fastapi uvicorn sqlalchemy python-multipart python-dotenv psycopg2-binary httpx
) else if exist backend\main.py (
    cd /d "%~dp0backend"
    python -m pip install --upgrade pip
    python -m pip install fastapi uvicorn sqlalchemy python-multipart python-dotenv psycopg2-binary httpx
) else (
    echo [ADVERTENCIA] No se encontro la app backend principal.
)

cd /d "%~dp0"
echo.
echo [2/2] Instalando dependencias del Frontend (Node.js/React)...
if exist frontend\package.json (
    cd /d "%~dp0frontend"
    npm install
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