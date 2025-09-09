@echo off
echo ========================================
echo VOICE TO REPORT - PERFECT STARTUP
echo ========================================
echo.
echo This combines the working parts of both versions:
echo - Backend setup in main window (like version 1)
echo - Frontend in separate window (like version 2)  
echo - All windows stay open for debugging
echo.
pause

echo Step 1: Stop existing services
taskkill /f /im python.exe >nul 2>&1
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ngrok.exe >nul 2>&1
echo Services stopped
pause

echo Step 2: Backend setup (in main window like working version)
cd backend
echo In backend directory: %CD%
pause

echo Step 3: Check if venv exists
if exist "venv" (
    echo venv exists
) else (
    echo Creating venv...
    python -m venv venv
    echo venv created
)
pause

echo Step 4: Install backend deps
call venv\Scripts\python.exe -m pip install -r requirements.txt
echo Backend deps done
pause

echo Step 5: Start backend (simple command that worked)
start "Backend Server" cmd /k "venv\Scripts\python.exe -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
echo Backend started in separate window
cd ..
pause

echo Step 6: Start ngrok
start "Ngrok Tunnel" cmd /k "ngrok http 8000"
echo Ngrok started in separate window
pause

echo Step 7: Start frontend (in separate window like working version)
start "Frontend Setup" cmd /k "cd /d %CD%\voice-report-app && echo Installing frontend dependencies... && npm install && echo Frontend deps done && echo Starting Expo... && npx expo start --tunnel"
echo Frontend started in separate window
pause

echo ========================================
echo             ALL DONE!
echo ========================================
echo.
echo Check the individual windows:
echo - Backend Server: Should show "Uvicorn running on http://0.0.0.0:8000"
echo - Ngrok Tunnel: Should show public URL and dashboard at http://localhost:4040
echo - Frontend Setup: Should show QR code for mobile testing
echo.
echo Services:
echo Backend API: http://localhost:8000
echo Backend Health: http://localhost:8000/health
echo Backend Docs: http://localhost:8000/docs
echo Ngrok Dashboard: http://localhost:4040
echo Frontend: Look for QR code in Frontend window
echo.
echo Mobile Testing:
echo 1. Install Expo Go app on your phone
echo 2. Scan QR code from Frontend window
echo 3. Test voice recording in the app
echo.
echo IMPORTANT: 
echo - Your OpenAI API key must be set in backend\.env
echo - Ngrok URL automatically updates in frontend config
echo - If mobile app can't connect, wait 30 seconds and restart the app
echo.
echo NGROK URL MANAGEMENT:
echo - Current ngrok URL is automatically detected and configured
echo - To manually get current URL: python ngrok_manager.py --url
echo - To manually update config: python ngrok_manager.py --update
echo - Dashboard shows current URL: http://localhost:4040
echo.
echo All service windows will stay open.
echo You can close this main window safely.
echo.
pause