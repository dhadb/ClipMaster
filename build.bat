@echo off
echo Building ClipMaster...
echo.
echo This may take a few minutes...
echo.
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npm run build
if errorlevel 1 (
    echo Build failed!
    exit /b 1
)
powershell -NoProfile -Command "Get-FileHash -Algorithm SHA256 release/*.exe | ForEach-Object { \"$($_.Hash)  $([System.IO.Path]::GetFileName($_.Path))\" } | Set-Content -Encoding ascii release/checksums.sha256"
echo.
echo Build complete! Check the 'release' folder for the installer.
echo.
pause
