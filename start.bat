@echo off
color 0B
echo Iniciando MVP de Recoleccion LSM...

:: Iniciar el Backend FastAPI desde la ruta real del proyecto
if exist backend\api\main.py (
    start "Servidor FastAPI (Backend)" cmd /k "cd /d "%~dp0backend" && uvicorn api.main:app --reload"
) else if exist backend\main.py (
    start "Servidor FastAPI (Backend)" cmd /k "cd /d "%~dp0backend" && uvicorn main:app --reload"
)

:: Iniciar el Frontend React desde la carpeta frontend
if exist frontend\package.json (
    start "Servidor React (Frontend)" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"
)

echo Servidores iniciados. Cierra las ventanas negras para apagar el sistema.