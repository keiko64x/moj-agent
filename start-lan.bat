@echo off
REM Agentoslaw Reaktowski — start na porcie 3000 z dostepem w sieci LAN
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-lan.ps1" %*
pause
