@echo off
echo ========================================
echo   ClipMaster Installer Builder
echo ========================================
echo.

set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/

echo [1/2] Building application and installer...
call npm run build
if errorlevel 1 (
    echo Failed to build application!
    pause
    exit /b 1
)
echo Done!
echo.

echo [2/2] Generating checksums...
powershell -NoProfile -Command "Get-FileHash -Algorithm SHA256 release/*.exe | ForEach-Object { \"$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))\" } | Set-Content -Encoding ascii release/checksums.sha256"
echo Done!
echo.

echo ========================================
echo   Build complete!
echo   Installer: release\
echo ========================================
pause
