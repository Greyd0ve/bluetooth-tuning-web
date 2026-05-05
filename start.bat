@echo off
setlocal
cd /d "%~dp0"

echo ========================================
echo Bluetooth Tuning Web - One Click Start
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [Error] Node.js was not found.
  echo Please install Node.js LTS first, then run this file again.
  echo Opening Node.js download page...
  start "" "https://nodejs.org/"
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [Error] npm was not found.
  echo Please reinstall Node.js LTS, then run this file again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo First run detected: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo [Error] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Starting local web server...
echo Browser will open: http://localhost:5173/
echo Keep this window open while using the website.
echo Press Ctrl+C in this window to stop the website.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start "" "http://localhost:5173/""
call npm run dev

pause
