param(
    [string]$AvdName = "Pixel_7_API_34",
    [string]$SdkPath,
    [switch]$ListAvds,
    [switch]$Verbose
)

Write-Host "=== Voice Report App: Android Emulator Launcher ===" -ForegroundColor Cyan

function Write-Diag($msg) { if ($Verbose) { Write-Host "[diag] $msg" -ForegroundColor DarkGray } }

# 1. Resolve Android SDK path more defensively (allow manual override)
$originalSdkRoot = $env:ANDROID_SDK_ROOT
$candidates = @()
if ($SdkPath) { $candidates += $SdkPath }
if ($env:ANDROID_SDK_ROOT) { $candidates += $env:ANDROID_SDK_ROOT }
if ($env:ANDROID_HOME)     { $candidates += $env:ANDROID_HOME }
$candidates += "$env:USERPROFILE\AppData\Local\Android\Sdk"
$candidates += "$env:LOCALAPPDATA\Android\Sdk"
$candidates += "C:\Program Files\Android\Android Studio\Sdk"

$resolvedSdk = $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $resolvedSdk) {
    Write-Error @"
Android SDK not found.
Checked (in order):
$(($candidates | Where-Object { $_ }) -join "`n")

Fix:
 1. Install Android Studio (https://developer.android.com/studio)
 2. Open it once, install SDK + Platform Tools (Android 14 / API 34+)
 3. Create a device in Device Manager (e.g. Pixel 8 API 35)
 4. Set a persistent variable (User scope is fine):
       setx ANDROID_SDK_ROOT "%USERPROFILE%\AppData\Local\Android\Sdk"
 5. Restart your terminal and re-run this script.
    (Or run again supplying -SdkPath <path>)
"@
    exit 1
}

$env:ANDROID_SDK_ROOT = $resolvedSdk
Write-Diag "Resolved SDK root: $resolvedSdk (was: $originalSdkRoot)"

$platformTools = Join-Path $resolvedSdk 'platform-tools'
$emulatorDir   = Join-Path $resolvedSdk 'emulator'

foreach ($p in @($platformTools, $emulatorDir)) {
    if (-not (Test-Path $p)) {
        Write-Error "Missing required SDK subdirectory: $p"; exit 1
    }
    if (-not ($env:PATH -split ';' | Where-Object { $_ -eq $p })) {
        $env:PATH = "$p;$env:PATH"
    }
}

# 2. Acquire AVD list (gracefully handle missing emulator.exe)
$emulatorExe = Join-Path $emulatorDir 'emulator.exe'
if (-not (Test-Path $emulatorExe)) {
    Write-Error "emulator.exe not found at $emulatorExe. Ensure the 'Android Emulator' component is installed via Android Studio > SDK Manager > SDK Tools."; exit 1
}

$avdListRaw = & $emulatorExe -list-avds 2>$null
$avdList = $avdListRaw -split "\r?\n" | Where-Object { $_ -and $_.Trim() -ne '' }

if ($ListAvds) {
    if (-not $avdList) { Write-Host "No AVDs found." -ForegroundColor Yellow } else { Write-Host "Available AVDs:" -ForegroundColor Cyan; $avdList | ForEach-Object { Write-Host "  $_" } }
    return
}

if (-not $avdList -or $avdList.Count -eq 0) {
    Write-Error "No Android Virtual Devices found. Create one in Android Studio > Device Manager first."; exit 1
}

if (-not ($avdList | Where-Object { $_ -eq $AvdName })) {
    Write-Warning "AVD '$AvdName' not found. Available: $(($avdList -join ', '))"
    Write-Host "Re-run with -AvdName <Name> or pass -ListAvds to list." -ForegroundColor Yellow
    exit 1
}

# 3. Start emulator if not already running
$adbExe = Join-Path $platformTools 'adb.exe'
if (-not (Test-Path $adbExe)) { Write-Error "adb.exe not found in $platformTools"; exit 1 }

$adbDevices = & $adbExe devices 2>$null | Select-String "device$" | ForEach-Object { $_.ToString() }
if ($adbDevices.Count -eq 0) {
    Write-Host "Starting emulator: $AvdName" -ForegroundColor Green
    Start-Process -FilePath $emulatorExe -ArgumentList "-avd", $AvdName -WindowStyle Normal
    Write-Host "Waiting for emulator to boot (this can take ~30-120s)..." -ForegroundColor DarkCyan
    & $adbExe wait-for-device
    $maxWait = 180; $elapsed = 0
    while ($elapsed -lt $maxWait) {
        $bootStatus = & $adbExe shell getprop sys.boot_completed 2>$null
        if ($bootStatus -match '1') { break }
        Start-Sleep -Seconds 3; $elapsed += 3; Write-Host "." -NoNewline
    }
    Write-Host ""
    if ($elapsed -ge $maxWait) { Write-Warning "Emulator boot not confirmed after $maxWait seconds; continuing." } else { Write-Host "Emulator booted in $elapsed seconds." -ForegroundColor Green }
} else { Write-Host "An emulator/device is already connected." -ForegroundColor Green }

# 4. Launch Expo (tunnel mode) and open on Android automatically
Write-Host "Launching Expo (tunnel) and opening on Android..." -ForegroundColor Cyan
if ($Verbose) { $expoCmd = "npx expo start --android --tunnel --clear" } else { $expoCmd = "npx expo start --android --tunnel" }
Write-Host $expoCmd -ForegroundColor DarkGray

Start-Process powershell -ArgumentList "-NoExit", "-Command", $expoCmd -WorkingDirectory (Resolve-Path "$PSScriptRoot/..")

Write-Host "Done. If the Expo Dev Tools open in a browser, press 'a' there or in the Metro terminal if it doesn't auto-launch." -ForegroundColor Cyan
