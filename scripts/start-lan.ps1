# Agentosław Reaktowski — start na :3000 z dostępem dla urządzeń w sieci lokalnej
# Użycie:
#   .\scripts\start-lan.ps1          # produkcja (build + start)
#   .\scripts\start-lan.ps1 -Dev     # tryb developerski
#   .\scripts\start-lan.ps1 -Port 3000 -Host 0.0.0.0

param(
  [switch]$Dev,
  [string]$ListenHost = "0.0.0.0",
  [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "=== Agentosław Reaktowski ===" -ForegroundColor Cyan
Write-Host "Katalog: $Root"
Write-Host "Tryb:    $(if ($Dev) { 'dev' } else { 'prod' })"
Write-Host "Bind:    http://${ListenHost}:${Port}"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "BŁĄD: brak Node.js. Zainstaluj Node 20+ i spróbuj ponownie." -ForegroundColor Red
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "BŁĄD: brak npm." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".env.local")) {
  if (Test-Path ".env.example") {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Utworzono .env.local z .env.example — uzupełnij GOOGLE_GENERATIVE_AI_API_KEY." -ForegroundColor Yellow
  } else {
    Write-Host "UWAGA: brak .env.local — agent AI może nie działać bez klucza API." -ForegroundColor Yellow
  }
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Instaluję zależności (npm install)..." -ForegroundColor Yellow
  npm install
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "Adresy dostępu:" -ForegroundColor Green
Write-Host "  - Ten serwer:  http://localhost:${Port}"
try {
  $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    Select-Object -ExpandProperty IPAddress -Unique
  foreach ($ip in $ips) {
    Write-Host "  - Sieć LAN:   http://${ip}:${Port}"
  }
} catch {
  # ignore
}
Write-Host "  (firewall Windows: zezwól na TCP $Port w sieci prywatnej)"
Write-Host ""

if ($Dev) {
  Write-Host "Uruchamiam tryb developerski..." -ForegroundColor Cyan
  npx next dev -H $ListenHost -p $Port
  exit $LASTEXITCODE
}

Write-Host "Buduję aplikację (npm run build)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Uruchamiam produkcję na ${ListenHost}:${Port}..." -ForegroundColor Cyan
npx next start -H $ListenHost -p $Port
exit $LASTEXITCODE
