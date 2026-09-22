@echo off
echo ========================================================
echo   Renaming project folder to GTA5GRP
echo ========================================================
echo.
echo NOTE: Please close Antigravity IDE / editors before running
echo       so Windows releases file handles on this folder.
echo.
cd /d "D:\projects"
ren "gta-V-GRP-EMS Assist" "GTA5GRP"
if %ERRORLEVEL% equ 0 (
    echo [SUCCESS] Folder renamed to D:\projects\GTA5GRP!
    echo You can now open D:\projects\GTA5GRP in your IDE.
) else (
    echo [ERROR] Could not rename. Please close your IDE, terminals,
    echo         or Explorer windows that have this folder open, then retry.
)
echo.
pause
