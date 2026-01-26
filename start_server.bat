@echo off
title Imagine CRM Server
color 0B

echo ==========================================
echo      IMAGINE CRM - SERVIDOR
echo ==========================================
echo.

:: Configuaracion de entorno para produccion local
set NODE_ENV=production
set PORT=3000

:: Habilitar Login DEV (quitar en produccion real si se desea)
set ALLOW_DEV_LOGIN=1
set VITE_DEV_BYPASS_AUTH=1
set OWNER_OPEN_ID=dev-owner

echo Iniciando servidor en puerto %PORT%...
echo.

:: Ejecutar servidor compilado
node dist/index.js

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo EL SERVIDOR SE DETUVO CON ERROR.
    echo Verifica si ya hay otro corriendo o si falta el 'build'.
    pause
)
