@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo    AGAIN  -  update ^& run
echo ============================================
echo.

echo [1/3] Pulling the latest from the branch...
git fetch origin
git checkout claude/session-history-access-KgOCR
git pull origin claude/session-history-access-KgOCR
if errorlevel 1 (
  echo.
  echo *** git pull failed. ***
  echo If you have local changes blocking it, run:  git stash
  echo Then run this file again.
  echo.
  pause
  exit /b 1
)
echo.

echo [2/3] Installing / updating dependencies...
call npm install
if errorlevel 1 (
  echo.
  echo *** npm install failed. ***
  echo Make sure Node.js is installed:  https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo.

echo [3/3] Starting the game...
echo A browser tab will open at http://localhost:5173/ in a few seconds.
echo Leave this window open while you play. Close it (or press Ctrl+C) to stop.
echo.

rem Open the browser a few seconds after the dev server starts.
start "" /min cmd /c "timeout /t 5 /nobreak >nul & start http://localhost:5173/"

call npm run dev

pause
