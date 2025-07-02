@echo off
REM Simple Voice-to-Report App Startup (Non-Interactive)
REM This script starts all services and exits, leaving them running

setlocal enabledelayedexpansion

REM Configuration
set BACKEND_DIR=backend
set FRONTEND_DIR=voice-report-app
set BACKEND_PORT=8000

echo.
echo 🚀 Starting Voice-to-Report App Services...
echo ============================================

REM Check prerequisites quickly
where python >nul 2>&1 || (echo ❌ Python not found & exit /b 1)
where node >nul 2>&1 || (echo ❌ Node.js not found & exit /b 1)
where npm >nul 2>&1 || (echo ❌ npm not found & exit /b 1)
where ngrok >nul 2>&1 || (echo ❌ ngrok not found & exit /b 1)

echo ✅ Prerequisites check passed

REM Stop any existing services silently
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq Voice Report Backend*" 2>nul
taskkill /f /im "ngrok.exe" 2>nul
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Voice Report Frontend*" 2>nul
wmic process where "name='python.exe' and commandline like '%%uvicorn%%'" delete 2>nul
wmic process where "name='ngrok.exe'" delete 2>nul

echo ℹ️ Starting backend server...
cd /d %BACKEND_DIR%

REM Setup virtual environment if needed
if not exist "venv" python -m venv venv
call venv\Scripts\python.exe -m pip install -r requirements.txt >nul 2>&1

REM Check .env file
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ⚠️ Created .env - please configure OPENAI_API_KEY
    )
)

REM Start backend
start "Voice Report Backend" /min cmd /c "venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload"
cd /d ..

echo ✅ Backend started on port %BACKEND_PORT%

REM Start ngrok
echo ℹ️ Starting ngrok tunnel...
start "Ngrok Tunnel" /min ngrok http %BACKEND_PORT%

REM Wait and update config
echo ℹ️ Waiting for services to initialize...
timeout /t 10 /nobreak >nul

echo ℹ️ Updating frontend configuration...
python ngrok_manager.py --update 2>nul
if errorlevel 1 (
    echo ⚠️ Manual config update needed - check http://localhost:4040
) else (
    echo ✅ Frontend configuration updated
)

REM Start frontend
echo ℹ️ Starting Expo development server...
cd /d %FRONTEND_DIR%

if not exist "node_modules" (
    echo ℹ️ Installing dependencies...
    call npm install >nul 2>&1
)

start "Voice Report Frontend" cmd /c "npx expo start --tunnel --clear"
cd /d ..

echo ✅ Expo started in tunnel mode

echo.
echo 🎉 All services started successfully!
echo =====================================
echo Backend: http://localhost:%BACKEND_PORT%
echo Ngrok Dashboard: http://localhost:4040
echo Frontend: Check the Expo DevTools window
echo.
echo 📱 Mobile Setup:
echo 1. Wait 30-60 seconds for tunnels to establish
echo 2. Open Expo Go on your phone
echo 3. Scan QR code from Expo DevTools
echo.
echo 🛑 To stop services: stop-services.bat
echo 🔄 To restart ngrok: startup.bat --restart-ngrok
echo.
echo Services are running in background windows.
echo You can close this window safely.
echo.
pause