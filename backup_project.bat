@echo off
title Guardando Copia de Seguridad...
color 0B

set "SOURCE=%~dp0"
set "DEST=%USERPROFILE%\Desktop\imagine-crm-backup-%date:~-4,4%%date:~-7,2%%date:~-10,2%.zip"

echo ==========================================
echo      BACKUP DEL SISTEMA CRM
echo ==========================================
echo.
echo Creando archivo ZIP en tu Escritorio...
echo Ignorando carpetas pesadas (node_modules, dist)...

powershell -Command "Compress-Archive -Path '%SOURCE%*' -DestinationPath '%DEST%' -CompressionLevel Optimal -Force"

echo.
echo ==========================================
echo      COPIA GUARDADA EXITOSAMENTE
echo ==========================================
echo.
echo Archivo creado: %DEST%
pause
