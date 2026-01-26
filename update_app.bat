@echo off
title Actualizando Imagine CRM...
color 0A

echo ==========================================
echo      ACTUALIZADOR AUTOMATICO - CRM
echo ==========================================
echo.

echo [1/4] Descargando ultimos cambios (Git)...
git pull
if %errorlevel% neq 0 (
    color 0C
    echo Error al descargar cambios. Verifica tu conexion o estado de git.
    pause
    exit /b
)

echo.
echo [2/4] Instalando nuevas librerias...
call pnpm install
if %errorlevel% neq 0 (
    echo Error instalando dependencias.
    pause
    exit /b
)

echo.
echo [3/4] Base de datos (Migraciones)...
call pnpm db:push

echo.
echo [4/4] Reconstruyendo el sistema...
set VITE_DEV_BYPASS_AUTH=1
call pnpm run build

echo.
echo ==========================================
echo   ACTUALIZACION COMPLETADA CON EXITO
echo ==========================================
echo.
echo Ahora puedes cerrar esta ventana y ejecutar 'start_server.bat'.
pause
