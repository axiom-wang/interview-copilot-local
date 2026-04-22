@echo off
setlocal

set "APP_DIR=%~dp0"
set "LOG_FILE=%APP_DIR%launcher.log"
set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"

cd /d "%APP_DIR%"

echo [%date% %time%] launcher started > "%LOG_FILE%"

if not exist "%NPM_CMD%" (
  echo [%date% %time%] npm.cmd not found at "%NPM_CMD%" >> "%LOG_FILE%"
  exit /b 1
)

if not exist node_modules (
  echo [%date% %time%] node_modules missing, running npm install >> "%LOG_FILE%"
  call "%NPM_CMD%" install >> "%LOG_FILE%" 2>&1
  if errorlevel 1 (
    echo [%date% %time%] npm install failed >> "%LOG_FILE%"
    exit /b 1
  )
)

echo [%date% %time%] running npm run dev >> "%LOG_FILE%"
call "%NPM_CMD%" run dev >> "%LOG_FILE%" 2>&1

if errorlevel 1 (
  echo [%date% %time%] npm run dev failed >> "%LOG_FILE%"
  exit /b 1
)
