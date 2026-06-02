@echo off
echo Building ClipMaster...
echo.
echo This may take a few minutes...
echo.
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npx vite build
call npx electron-builder --win
echo.
echo Build complete! Check the 'release' folder for the installer.
echo.
pause
