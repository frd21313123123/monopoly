@echo off
cd /d "%~dp0"
set PNPM=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\2f053e67fec2d258\bin\node_modules\corepack\shims\pnpm.cmd

if not exist "%PNPM%" (
    echo ERROR: pnpm not found at %PNPM%
    pause
    exit /b 1
)

start "Monopoly Server" cmd /k "cd /d "%~dp0" && "%PNPM%" --filter @monopoly/server dev"
start "Monopoly Client" cmd /k "cd /d "%~dp0" && "%PNPM%" --filter @monopoly/client dev"

echo Waiting for client to start...
timeout /t 5 /nobreak > nul
start "" "http://localhost:5173"
