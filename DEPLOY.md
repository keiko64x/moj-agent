# Agentosław Reaktowski — wdrożenie na serwer

## Wymagania
- Node.js **20+** (zalecane LTS)
- npm
- Klucz Google Generative AI w `.env.local`

## Szybki start (sieć lokalna / third parties)

### Windows
1. Rozpakuj paczkę na serwerze.
2. Skopiuj `.env.example` → `.env.local` i wstaw klucz API.
3. Dwuklik: `start-lan.bat`  
   albo w PowerShell:
   ```powershell
   .\scripts\start-lan.ps1
   ```
4. Otwórz:
   - lokalnie: `http://localhost:3000`
   - z innych urządzeń: `http://<IP-serwera>:3000`

Tryb deweloperski:
```powershell
.\scripts\start-lan.ps1 -Dev
```

### Linux / macOS
```bash
chmod +x scripts/start-lan.sh
cp .env.example .env.local   # uzupełnij klucz
./scripts/start-lan.sh       # produkcja
./scripts/start-lan.sh dev   # development
```

## Co robi skrypt
1. `npm install` (jeśli brak `node_modules`)
2. `npm run build` (produkcja)
3. `next start -H 0.0.0.0 -p 3000` — nasłuch na wszystkich interfejsach (dostęp z LAN)

Port / host można nadpisać:
```bash
HOST=0.0.0.0 PORT=3000 ./scripts/start-lan.sh
```
```powershell
.\scripts\start-lan.ps1 -ListenHost 0.0.0.0 -Port 3000
```

## Firewall
Na serwerze otwórz **TCP 3000** dla sieci lokalnej (nie wystawiaj publicznie bez reverse proxy / HTTPS).

### Windows (admin PowerShell)
```powershell
New-NetFirewallRule -DisplayName "Agentoslaw 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

### Linux (ufw)
```bash
sudo ufw allow 3000/tcp
```

## Ręcznie (bez skryptu)
```bash
npm install
npm run build
npm start
```
(`npm start` = `next start -H 0.0.0.0 -p 3000`)

## Bezpieczeństwo
- **Nie commituj** `.env.local` (jest w `.gitignore`).
- Paczka wdrożeniowa **nie zawiera** klucza API — dodaj go na serwerze.
- Do internetu publicznego użyj Nginx/Caddy + HTTPS zamiast surowego `:3000`.
