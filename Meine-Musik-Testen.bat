@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   Meine Musik - Lokaler Test-Modus
echo ============================================
echo.

if not exist node_modules (
  echo Einmalige Ersteinrichtung, dauert kurz...
  call npm install
  if errorlevel 1 (
    echo.
    echo Fehler bei npm install. Fenster bleibt offen.
    pause
    exit /b 1
  )
)

echo Starte App-Fenster + lokalen Server...
echo (Erster Start kompiliert Rust-Code, kann ein paar Minuten dauern.
echo  Danach ist jede Aenderung an Dateien in src/ sofort da, ohne Neustart.)
echo.
echo Handy-Test: sobald unten "Handy: http://..." erscheint, diese
echo Adresse im Handy-Browser (selbes WLAN) eingeben.
echo.

call npm run dev

echo.
echo App beendet.
pause
