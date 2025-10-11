$ErrorActionPreference = 'Stop'

function Check($cond, $msg){ if($cond){ Write-Host "[OK] $msg" -ForegroundColor Green } else { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:hadError = $true } }
function Info($msg){ Write-Host "[INFO] $msg" -ForegroundColor Cyan }

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$staging = Join-Path $repoRoot 'backend_staging'
$zip = Join-Path $repoRoot 'backend_deploy.zip'

Info "Repo root: $repoRoot"
Info "Staging: $staging"

# 1. services folder exists with .py files
$services = Join-Path $staging 'services'
Check (Test-Path $services) "services folder exists"
$pyFiles = Get-ChildItem -Path $services -Filter *.py -File -ErrorAction SilentlyContinue
Check ($pyFiles.Count -gt 0) "services has python files: $($pyFiles.Name -join ', ')"

# 2. __init__.py exists
Check (Test-Path (Join-Path $services '__init__.py')) "services/__init__.py exists"

# 3. main.py can import services (basic static check + optional import test)
$mainPath = Join-Path $staging 'main.py'
Check (Test-Path $mainPath) "main.py exists"
$mainText = Get-Content $mainPath -Raw
$referencesServices = $mainText -match 'services'
Check $referencesServices "main.py references services (heuristic)"

# 4. requirements-azure.txt exists and not empty
$req = Join-Path $staging 'requirements-azure.txt'
Check (Test-Path $req) "requirements-azure.txt exists"
if (Test-Path $req) {
    $reqLines = Get-Content $req | Where-Object { $_ -match '\S' }
    Check ($reqLines.Count -gt 0) "requirements-azure.txt has content"
}

# 5. startup.sh exists (note: execute bit is a Linux concept, verified on server)
$startup = Join-Path $staging 'startup.sh'
Check (Test-Path $startup) "startup.sh exists"

# 6. .deployment exists with SCM_DO_BUILD_DURING_DEPLOYMENT=true
$deploymentFile = Join-Path $staging '.deployment'
Check (Test-Path $deploymentFile) ".deployment exists"
if(Test-Path $deploymentFile){
    $depText = Get-Content $deploymentFile -Raw
    Check ($depText -match 'SCM_DO_BUILD_DURING_DEPLOYMENT\s*=\s*true') ".deployment sets SCM_DO_BUILD_DURING_DEPLOYMENT=true"
}

# 7. Zip root structure (if zip exists)
if(Test-Path $zip){
    Info "Inspecting zip: $zip"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $entries = [System.IO.Compression.ZipFile]::OpenRead($zip).Entries
    $hasRootMain = $entries.FullName -contains 'main.py'
    # Match services directory at root with either slash or backslash
    $hasRootServices = ($entries.FullName -match '^services[\\/]')
    $hasNested = ($entries.FullName -match '^backend_staging[\\/]')
    Check $hasRootMain "zip has main.py at root"
    Check $hasRootServices "zip has services/ at root"
    Check (-not $hasNested) "zip doesn't have extra nesting (backend_staging/)"
} else {
    Info "Zip file not found yet; run scripts/deploy-backend.ps1 to create it."
}

if($script:hadError){
    Write-Host "\nChecks completed with failures." -ForegroundColor Red
    exit 1
} else {
    Write-Host "\nAll checks passed." -ForegroundColor Green
}
