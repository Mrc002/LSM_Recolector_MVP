@echo off
echo ==========================================
echo 🚀 Iniciando Plataforma de Recolección LSM...
echo ==========================================

echo 🐍 Levantando el Backend en el puerto 8000...
:: Abre una nueva ventana para el backend (si usas un entorno virtual, agregalo antes del uvicorn)
start "Backend FastAPI" cmd /k "cd backend && uvicorn main:app --reload --port 8000"

echo ⚛️ Levantando el Frontend en el puerto 5173...
:: Abre una nueva ventana para el frontend
start "Frontend React" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Todos los sistemas se estan abriendo en ventanas separadas.
echo 👉 Frontend (Tu Interfaz): http://localhost:5173
echo 👉 Backend (FastAPI API):  http://localhost:8000/docs
echo ==========================================
echo ⚠️ Para apagar los servidores, simplemente cierra las dos ventanas negras que se abrieron.
echo ==========================================