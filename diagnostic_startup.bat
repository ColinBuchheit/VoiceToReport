@echo off
echo ========================================
echo DIAGNOSTIC NGROK UPDATE TEST
echo ========================================
echo.

REM Store the original directory
set ORIGINAL_DIR=%CD%
echo 📁 Script started in: %ORIGINAL_DIR%

echo.
echo Step 1: Basic file checks
echo 📋 Checking if ngrok_manager.py exists in current directory:
if exist ngrok_manager.py (
    echo ✅ Found ngrok_manager.py
) else (
    echo ❌ ngrok_manager.py NOT found in current directory
    echo 🔍 Let me check subdirectories...
    if exist backend\ngrok_manager.py echo 📁 Found in backend\
    if exist voice-report-app\ngrok_manager.py echo 📁 Found in voice-report-app\
)

echo.
echo 📋 Checking if voice-report-app directory exists:
if exist voice-report-app (
    echo ✅ Found voice-report-app directory
    if exist voice-report-app\services (
        echo ✅ Found voice-report-app\services directory
        if exist voice-report-app\services\api-config.ts (
            echo ✅ Found voice-report-app\services\api-config.ts
            echo 📅 Current file timestamp:
            forfiles /m api-config.ts /s /p voice-report-app\services /c "cmd /c echo @fdate @ftime"
        ) else (
            echo ❌ api-config.ts NOT found
        )
    ) else (
        echo ❌ services directory NOT found
    )
) else (
    echo ❌ voice-report-app directory NOT found
)

echo.
echo Step 2: Start minimal services for testing
echo 🛑 Stopping existing processes...
taskkill /f /im ngrok.exe >nul 2>&1

echo 🌐 Starting ngrok (need this for the API)...
start "Test Ngrok" /min ngrok http 8000

echo ⏱️ Waiting 15 seconds for ngrok to establish...
timeout /t 15 /nobreak >nul

echo.
echo Step 3: Test ngrok API directly
echo 🌐 Testing ngrok API availability:
python -c "import requests; r=requests.get('http://localhost:4040/api/tunnels', timeout=5); print('✅ Ngrok API Status:', r.status_code); print('📊 Tunnels found:', len(r.json().get('tunnels', [])))" 2>nul
if errorlevel 1 (
    echo ❌ Ngrok API test failed
    echo 💡 Possible reasons:
    echo    - Ngrok hasn't started yet
    echo    - Ngrok is not running on port 4040
    echo    - Network connectivity issue
) else (
    echo ✅ Ngrok API is responding
)

echo.
echo Step 4: Test ngrok_manager.py URL retrieval
echo 🔍 Testing if we can get ngrok URL:
python ngrok_manager.py --url
if errorlevel 1 (
    echo ❌ Failed to get ngrok URL
) else (
    echo ✅ Successfully got ngrok URL
)

echo.
echo Step 5: Test file path resolution
echo 🗂️ Testing file paths:
python -c "from pathlib import Path; config_file = Path('voice-report-app') / 'services' / 'api-config.ts'; print('📁 Resolved path:', config_file.absolute()); print('📋 File exists:', config_file.exists())"

echo.
echo Step 6: Run update with full error output
echo 🔄 Running ngrok_manager.py --update (with full error output):
echo 📁 Current directory: %CD%
python ngrok_manager.py --update
set UPDATE_RESULT=%ERRORLEVEL%

if %UPDATE_RESULT% EQU 0 (
    echo ✅ Update command returned success
    echo 📅 Checking if file timestamp changed:
    forfiles /m api-config.ts /s /p voice-report-app\services /c "cmd /c echo @fdate @ftime"
    
    echo 📋 Checking if file content changed:
    findstr "Last updated" voice-report-app\services\api-config.ts
) else (
    echo ❌ Update command failed with error code: %UPDATE_RESULT%
)

echo.
echo Step 7: Manual verification
echo 🔍 Current ngrok URL according to manager:
python ngrok_manager.py --url 2>nul

echo 🔍 Current URL in api-config.ts:
findstr "ngrok-free.app\|ngrok.io" voice-report-app\services\api-config.ts

echo.
echo ========================================
echo           DIAGNOSTIC COMPLETE
echo ========================================
echo.
echo 📋 Summary of findings will help identify the issue.
echo 🛑 You can now stop the test ngrok process.
echo.
pause