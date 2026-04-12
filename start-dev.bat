@echo off
REM Development Mode Start Script for Windows

echo 🚀 Starting Ujiin...
echo.
echo 📋 Instructions:
echo 1. Terminal 1: Backend (PHP Server)
echo 2. Terminal 2: Frontend (React Dev Server)
echo 3. Terminal 3: Database (MySQL via XAMPP)
echo.

REM Backend
start "Backend Server" cmd /k "cd backend && php -S localhost:8000"

timeout /t 2 /nobreak

REM Frontend
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ✅ Servers starting...
echo.
echo 🌐 URLs:
echo    Frontend: http://localhost:5173
echo    Backend:  http://localhost:8000
echo    PhpMyAdmin: http://localhost/phpmyadmin
echo.
echo 📧 Test Account:
echo    Email: test@example.com
echo    Password: test1234
echo.
pause
