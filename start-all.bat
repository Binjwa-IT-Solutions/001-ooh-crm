@echo off
title Media Octus CRM Launcher
echo ============================================================
echo           Starting Media Octus CRM + AI Chatbot
echo ============================================================
echo.

echo [1/3] Starting Python AI Chatbot (Port 8000)...
start "Media Octus - Python Chatbot (Port 8000)" cmd /k "cd /d %~dp0chatbot && .venv\Scripts\python.exe app.py"

timeout /t 2 /nobreak >nul

echo [2/3] Starting Node.js Backend Server (Port 5000)...
start "Media Octus - Backend (Port 5000)" cmd /k "cd /d %~dp0backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [3/3] Starting Frontend Next.js Server (Port 3000)...
start "Media Octus - Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo   All 3 servers have been launched in separate windows!
echo   - Frontend:       http://localhost:3000
echo   - Node.js API:    http://localhost:5000
echo   - Python Chatbot: http://localhost:8000
echo ============================================================
echo.
