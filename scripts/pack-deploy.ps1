# Tworzy paczkę ZIP gotową do wgrania na serwer (bez node_modules, .next, sekretów)
param(
  [string]$OutDir = "$env:USERPROFILE\Desktop"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Stamp = Get-Date -Format "yyyyMMdd-HHmm"
$ZipName = "Agentoslaw-Reaktowski-deploy-$Stamp.zip"
$ZipPath = Join-Path $OutDir $ZipName
$Staging = Join-Path $env:TEMP "agentoslaw-pack-$Stamp"

if (Test-Path $Staging) { Remove-Item $Staging -Recurse -Force }
New-Item -ItemType Directory -Path $Staging | Out-Null

$ExcludeDirs = @('node_modules', '.next', '.git', 'out', 'dist', 'coverage', '.vercel')
$ExcludeFiles = @('.env', '.env.local', '.env.production.local', '.env.development.local')

Write-Host "Kopiuję pliki z: $Root"
Write-Host "Do staging:     $Staging"

Get-ChildItem -Path $Root -Force | ForEach-Object {
  $name = $_.Name
  if ($ExcludeDirs -contains $name) {
    Write-Host "  pomijam katalog: $name"
    return
  }
  if ($ExcludeFiles -contains $name) {
    Write-Host "  pomijam plik: $name"
    return
  }
  Copy-Item -Path $_.FullName -Destination (Join-Path $Staging $name) -Recurse -Force
}

# Upewnij się, że skrypt sh ma LF (przyda się na Linuxie)
$sh = Join-Path $Staging "scripts\start-lan.sh"
if (Test-Path $sh) {
  $content = [System.IO.File]::ReadAllText($sh) -replace "`r`n", "`n"
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($sh, $content, $utf8NoBom)
}

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Compress-Archive -Path (Join-Path $Staging '*') -DestinationPath $ZipPath -CompressionLevel Optimal
Remove-Item $Staging -Recurse -Force

$sizeMb = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host ""
Write-Host "GOTOWE: $ZipPath ($sizeMb MB)" -ForegroundColor Green
Write-Host "Na serwerze: rozpakuj → uzupełnij .env.local → start-lan.bat / ./scripts/start-lan.sh"
