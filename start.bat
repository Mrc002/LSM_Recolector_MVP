@echo off
color 0B
echo Iniciando MVP de Recoleccion LSM...

:: Iniciar el Backend en una nueva ventana
if exist main.py (
    start "Servidor FastAPI (Backend)" cmd /k "uvicorn main:app --reload"
) else if exist backend\main.py (
    start "Servidor FastAPI (Backend)" cmd /k "cd backend && uvicorn main:app --reload"
)

:: Iniciar el Frontend en una nueva ventana
if exist package.json (
    start "Servidor React (Frontend)" cmd /k "npm run dev"
) else if exist frontend\package.json (
    start "Servidor React (Frontend)" cmd /k "cd frontend && npm run dev"
)

echo Servidores iniciados. Cierra las ventanas negras para apagar el sistema.