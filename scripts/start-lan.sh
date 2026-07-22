#!/usr/bin/env bash
# Agentosław Reaktowski — start na :3000 z dostępem dla urządzeń w sieci lokalnej
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"
MODE="${1:-prod}" # prod | dev

echo "=== Agentosław Reaktowski ==="
echo "Katalog: $ROOT"
echo "Tryb:    $MODE"
echo "Bind:    http://${HOST}:${PORT}"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "BŁĄD: brak Node.js. Zainstaluj Node 20+ i spróbuj ponownie."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "BŁĄD: brak npm."
  exit 1
fi

if [[ ! -f .env.local ]]; then
  if [[ -f .env.example ]]; then
    cp .env.example .env.local
    echo "Utworzono .env.local z .env.example — uzupełnij GOOGLE_GENERATIVE_AI_API_KEY."
  else
    echo "UWAGA: brak .env.local — agent AI może nie działać bez klucza API."
  fi
fi

if [[ ! -d node_modules ]]; then
  echo "Instaluję zależności (npm install)..."
  npm install
fi

# Pokaż lokalne IP (LAN)
echo
echo "Adresy dostępu:"
echo "  - Ten serwer:  http://localhost:${PORT}"
if command -v hostname >/dev/null 2>&1; then
  mapfile -t IPS < <(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' || true)
  for ip in "${IPS[@]:-}"; do
    [[ -n "$ip" ]] && echo "  - Sieć LAN:   http://${ip}:${PORT}"
  done
fi
echo "  (firewall: otwórz TCP ${PORT} dla sieci lokalnej)"
echo

if [[ "$MODE" == "dev" ]]; then
  echo "Uruchamiam tryb developerski..."
  exec npx next dev -H "$HOST" -p "$PORT"
fi

echo "Buduję aplikację (npm run build)..."
npm run build

echo "Uruchamiam produkcję na ${HOST}:${PORT}..."
exec npx next start -H "$HOST" -p "$PORT"
