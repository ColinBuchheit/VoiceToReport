@echo off
REM FIXED Voice-to-Report App Startup Script
REM This version ensures backend actually starts and runs properly

setlocal enabledelayedexpansion

REM Configuration
set BACKEND_DIR=backend
set FRONTEND_DIR=voice-report-app
set BACKEND_PORT=8000

echo.
echo 🚀 Starting Voice-to-Report App Services (FIXED VERSION)
echo ============================================

REM Check prerequisites
echo ℹ️ Checking prerequisites...
where python >nul 2>&1 || (echo ❌ Python not found & pause & exit /b 1)
where node >nul 2>&1 || (echo ❌ Node.js not found & pause & exit /b 1)
where npm >nul 2>&1 || (echo ❌ npm not found & pause & exit /b 1)
where ngrok >nul 2>&1 || (echo ❌ ngrok not found & pause & exit /b 1)
echo ✅ Prerequisites check passed

REM Stop any existing services more thoroughly
echo ℹ️ Stopping existing services...
taskkill /f /im "python.exe" /fi "WINDOWTITLE eq Voice Report Backend*" 2>nul
taskkill /f /im "ngrok.exe" 2>nul
taskkill /f /im "node.exe" /fi "WINDOWTITLE eq Voice Report Frontend*" 2>nul
wmic process where "name='python.exe' and commandline like '%%uvicorn%%'" delete 2>nul
wmic process where "name='ngrok.exe'" delete 2>nul

REM Wait a moment for processes to fully terminate
timeout /t 2 /nobreak >nul

echo ℹ️ Starting backend server...
cd /d %BACKEND_DIR%

REM Create virtual environment if needed
if not exist "venv" (
    echo 📦 Creating Python virtual environment...
    python -m venv venv
    if errorlevel 1 (
        echo ❌ Failed to create virtual environment
        cd /d ..
        pause
        exit /b 1
    )
)

REM Install/update dependencies
echo 📦 Installing Python dependencies...
call venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install Python dependencies
    echo Check that requirements.txt exists and contains valid packages
    cd /d ..
    pause
    exit /b 1
)

REM Check .env file
if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo ⚠️ Created .env from template
        echo ⚠️ IMPORTANT: Edit backend\.env and add your OPENAI_API_KEY!
        echo    The backend will not work without a valid API key.
    ) else (
        echo ❌ No .env or .env.example file found!
        echo Create backend\.env with: OPENAI_API_KEY=your_key_here
        cd /d ..
        pause
        exit /b 1
    )
)

REM FIXED: Start backend with better error handling and verification
echo 🌐 Starting FastAPI backend server...
echo    Binding to all interfaces (0.0.0.0:%BACKEND_PORT%) for mobile/ngrok access

REM Start backend and capture output for debugging
start "Voice Report Backend" cmd /c "cd /d %CD% && venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port %BACKEND_PORT% --reload > ..\backend.log 2>&1 || pause"

cd /d ..

REM CRITICAL: Wait longer for backend to fully initialize
echo ℹ️ Waiting for backend to initialize...
timeout /t 12 /nobreak >nul

REM FIXED: Verify backend is actually running before proceeding
echo 🔍 Verifying backend started successfully...
python -c "import requests; r=requests.get('http://localhost:%BACKEND_PORT%/health', timeout=5); print('✅ Backend is healthy:', r.json())" 2>nul
if errorlevel 1 (
    echo ❌ Backend health check failed!
    echo 🔍 Checking backend logs for errors...
    if exist backend.log (
        echo.
        echo === BACKEND ERROR LOG ===
        type backend.log
        echo === END LOG ===
        echo.
    )
    echo 💡 Common fixes:
    echo    1. Check that backend\.env has a valid OPENAI_API_KEY
    echo    2. Ensure no other service is using port %BACKEND_PORT%
    echo    3. Check backend.log for detailed error messages
    echo.
    echo ⏸️ Backend failed to start. Press any key to continue anyway...
    pause >nul
) else (
    echo ✅ Backend server is running and healthy on port %BACKEND_PORT%
)

REM Start ngrok tunnel
echo ℹ️ Starting ngrok tunnel...
start "Ngrok Tunnel" /min ngrok http %BACKEND_PORT%

REM Wait for ngrok to establish tunnel
echo ℹ️ Waiting for ngrok tunnel to establish...
timeout /t 10 /nobreak >nul

REM Update frontend configuration with current URLs
echo ℹ️ Updating frontend configuration...
python ngrok_manager.py --update 2>nul
if errorlevel 1 (
    echo ⚠️ Auto-config failed - manual setup needed
    echo 🔍 Check ngrok dashboard: http://localhost:4040
    echo 📝 You may need to update voice-report-app\services\api-config.ts manually
) else (
    echo ✅ Frontend configuration updated with current ngrok URL
)

REM Start frontend
echo ℹ️ Starting frontend application...
cd /d %FRONTEND_DIR%

REM Install frontend dependencies if needed
if not exist "node_modules" (
    echo 📦 Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo ❌ Failed to install frontend dependencies
        cd /d ..
        pause
        exit /b 1
    )
)

REM Start Expo in tunnel mode for mobile access
echo 🌐 Starting Expo development server in tunnel mode...
start "Voice Report Frontend" cmd /c "npx expo start --tunnel --clear"

cd /d ..

REM Final status and instructions
echo.
echo 🎉 All services started successfully!
echo =====================================
echo 🖥️  Backend API: http://localhost:%BACKEND_PORT%
echo 🏥 Backend Health: http://localhost:%BACKEND_PORT%/health
echo 📋 API Docs: http://localhost:%BACKEND_PORT%/docs
echo 🌐 Ngrok Dashboard: http://localhost:4040
echo 📱 Frontend: Check the Expo DevTools window
echo.
echo 📋 IMPORTANT SETUP STEPS:
echo =====================================
echo 1. ⏱️  Wait 30-60 seconds for all tunnels to fully establish
echo 2. 🔑 VERIFY your OpenAI API key is set in backend\.env file
echo 3. 🌐 Check ngrok dashboard (http://localhost:4040) for current URL
echo 4. 📱 Open Expo Go app on your phone
echo 5. 📷 Scan QR code from Expo DevTools window
echo 6. 🎤 Test voice recording once app loads on mobile
echo.
echo 🔧 Troubleshooting:
echo =====================================
echo ❌ If backend fails: 
echo    • Check backend\.env has valid OPENAI_API_KEY
echo    • Review backend.log for error details
echo    • Ensure port %BACKEND_PORT% is not in use by another app
echo.
echo ❌ If mobile app gets 400 errors:
echo    • Wait longer for ngrok tunnel to establish
echo    • Check ngrok dashboard shows your tunnel
echo    • Verify backend health check returns JSON (not error page)
echo.
echo ❌ If ngrok shows connection refused:
echo    • Backend is not running - check backend.log
echo    • Try restarting just the backend service
echo.
echo 📊 Service Status Check:
echo =====================================
echo 🔍 Test backend: curl http://localhost:%BACKEND_PORT%/health
echo 🔍 Test ngrok: python ngrok_manager.py --test
echo 🔍 Get ngrok URL: python ngrok_manager.py --url
echo.
echo 🛑 To stop all services: run stop-services.bat
echo 🔄 To restart ngrok only: startup.bat --restart-ngrok
echo.

REM Check if .env needs attention
cd /d %BACKEND_DIR%
findstr "your_openai_api_key_here" .env >nul 2>&1
if not errorlevel 1 (
    echo.
    echo ⚠️⚠️⚠️ CRITICAL: OpenAI API Key Not Configured! ⚠️⚠️⚠️
    echo.
    echo 🔑 Your backend\.env file still contains placeholder text.
    echo 📝 Edit backend\.env and replace 'your_openai_api_key_here' with your actual API key.
    echo 🚨 The voice transcription will NOT WORK without a valid OpenAI API key!
    echo.
    echo To get an API key:
    echo 1. Go to https://platform.openai.com/api-keys
    echo 2. Create a new secret key
    echo 3. Copy it to backend\.env file
    echo.
)
cd /d ..

echo Services are running in background windows.
echo You can close this window safely after verifying everything works.
echo.
echo Press any key to continue...
pause >nul