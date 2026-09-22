@echo off
setlocal
cd /d "%~dp0"

echo Iniciando MVP de Recoleccion LSM...

if exist backend\api\main.py (
    echo Iniciando backend FastAPI...
    start "Servidor FastAPI (Backend)" cmd /k "cd /d ""%~dp0backend"" && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload"
) else if exist backend\main.py (
    echo Iniciando backend FastAPI desde backend/main.py...
    start "Servidor FastAPI (Backend)" cmd /k "cd /d ""%~dp0backend"" && python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
) else (
    echo [ERROR] No se encontro la app backend principal.
)

if exist frontend\package.json (
    echo Iniciando frontend React...
    start "Servidor React (Frontend)" cmd /k "cd /d ""%~dp0frontend"" && npm install && npm run dev -- --host 0.0.0.0"
) else (
    echo [ERROR] No se encontro el proyecto frontend.
)

echo Servidores iniciados. Cierra las ventanas de la terminal para apagarlos.
exit /b 0