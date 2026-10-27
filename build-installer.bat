@echo off
rem ---------------------------------------------------------------------------
rem The Windows installer is produced by electron-builder, not by a hand-written
rem NSIS script: package.json -> build.win.target = ["nsis", "portable"].
rem This .bat is only a convenience wrapper for "npm run build" + checksums.
rem The former installer/installer.nsi was removed, see docs/DECISIONS.md (D-001).
rem ---------------------------------------------------------------------------
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
