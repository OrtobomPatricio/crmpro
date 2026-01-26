@echo off
echo ========================================
echo   Imagine CRM Pro - Inicio Local
echo ========================================
echo.

REM Verificar si Docker Desktop está corriendo
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Desktop no está corriendo.
    echo.
    echo Por favor:
    echo 1. Abrí Docker Desktop
    echo 2. Esperá a que esté completamente iniciado
    echo 3. Ejecutá este script nuevamente
    echo.
    pause
    exit /b 1
)

echo [OK] Docker Desktop está corriendo
echo.

REM Iniciar MySQL
echo Iniciando MySQL...
docker compose up -d mysql

REM Esperar a que MySQL esté listo
echo Esperando a que MySQL esté listo...
timeout /t 10 /nobreak >nul

REM Verificar conectividad
echo Verificando conectividad con MySQL...
powershell -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 3307 -InformationLevel Quiet" >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] MySQL puede no estar listo todavía. Esperando 5 segundos más...
    timeout /t 5 /nobreak >nul
)

echo [OK] MySQL está listo
echo.

REM Iniciar el servidor
echo Iniciando servidor en modo desarrollo...
echo.
pnpm dev
