@echo off
echo ========================================
echo   ClipMaster Installer Builder
echo ========================================
echo.

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo [1/4] Building main application...
call npx vite build
if errorlevel 1 (
    echo Failed to build main app!
    pause
    exit /b 1
)
echo Done!
echo.

echo [2/4] Building installer application...
cd installer-app
call npx electron-builder --dir
if errorlevel 1 (
    echo Failed to build installer app!
    pause
    exit /b 1
)
cd ..
echo Done!
echo.

echo [3/4] Copying app files to installer...
if exist "installer-app\release\win-unpacked\resources\app\win-unpacked" (
    rmdir /s /q "installer-app\release\win-unpacked\resources\app\win-unpacked"
)
xcopy /E /I /Y "release\win-unpacked" "installer-app\release\win-unpacked\resources\app\win-unpacked"
echo Done!
echo.

echo [4/4] Creating final installer...
cd installer-app
call npx electron-builder --win
cd ..
echo Done!
echo.

echo ========================================
echo   Build complete!
echo   Installer: installer-app\release\
echo ========================================
pause
