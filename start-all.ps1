# Media Octus CRM - 1-Click PowerShell Launcher
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "       Starting Media Octus CRM + AI Chatbot Servers" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Launching Python AI Chatbot (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\chatbot'; Write-Host '--- Python AI Chatbot Server (Port 8000) ---' -ForegroundColor Green; .\.venv\Scripts\python.exe app.py"

Start-Sleep -Seconds 2

Write-Host "[2/3] Launching Node.js Backend Server (Port 5000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; Write-Host '--- Node.js Backend Server (Port 5000) ---' -ForegroundColor Green; npm run dev"

Start-Sleep -Seconds 2

Write-Host "[3/3] Launching Next.js Frontend Server (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; Write-Host '--- Next.js Frontend Server (Port 3000) ---' -ForegroundColor Green; npm run dev"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  All 3 servers are running in separate PowerShell windows!" -ForegroundColor Green
Write-Host "  - Frontend:       http://localhost:3000" -ForegroundColor White
Write-Host "  - Node.js API:    http://localhost:5000" -ForegroundColor White
Write-Host "  - Python Chatbot: http://localhost:8000" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
