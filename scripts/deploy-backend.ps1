param(
    [string]$StagingDir = "$(Join-Path $PSScriptRoot '..\backend_staging')",
    [string]$ZipPath = "$(Join-Path $PSScriptRoot '..\backend_deploy.zip')"
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg){ Write-Host "`n=== $msg ===" -ForegroundColor Cyan }
function Fail($msg){ Write-Error $msg; exit 1 }

# Resolve full paths
$StagingDir = (Resolve-Path $StagingDir).Path
$ZipPath = (Resolve-Path (Split-Path $ZipPath -Parent)).Path + "\" + (Split-Path $ZipPath -Leaf)

Write-Step "Using staging folder: $StagingDir"
if (!(Test-Path $StagingDir)) { Fail "Staging folder not found: $StagingDir" }

# Ensure required files exist
$requiredFiles = @(
    'main.py',
    'models.py',
    'config_azure.py',
    'startup.sh',
    'requirements-azure.txt'
)

$missing = @()
foreach($f in $requiredFiles){ if(!(Test-Path (Join-Path $StagingDir $f))){ $missing += $f } }
if($missing.Count -gt 0){ Fail ("Missing required files in staging: " + ($missing -join ', ')) }

# Ensure services folder and __init__.py exist
$servicesPath = Join-Path $StagingDir 'services'
if(!(Test-Path $servicesPath)) { Fail "Missing services folder at $servicesPath" }
if(!(Test-Path (Join-Path $servicesPath '__init__.py'))) { Fail "Missing services/__init__.py" }

# Ensure .deployment file exists with expected content
$deploymentFile = Join-Path $StagingDir '.deployment'
if(!(Test-Path $deploymentFile)){
    Write-Host "Creating .deployment file" -ForegroundColor Yellow
    @"
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=true
"@ | Set-Content -Path $deploymentFile -Encoding UTF8
}

# Create ZIP from specific items to avoid extra nesting
Write-Step "Creating zip: $ZipPath"
if(Test-Path $ZipPath){ Remove-Item $ZipPath -Force }
Push-Location $StagingDir
try {
    $items = @(
        'main.py',
        'models.py',
        'config_azure.py',
        'startup.sh',
        'requirements-azure.txt',
        '.deployment',
        'services'
    )
    Compress-Archive -Path $items -DestinationPath $ZipPath -Force
}
finally {
    Pop-Location
}

# List zip entries
Write-Step "Zip contents"
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::OpenRead($ZipPath).Entries | ForEach-Object { $_.FullName }

Write-Host "`n✅ Package created: $ZipPath" -ForegroundColor Green
