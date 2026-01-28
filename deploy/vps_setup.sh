#!/bin/bash
set -e

echo "🚀 Iniciando configuración del VPS para CRM PRO..."

# 1. Install Docker & Compose if missing
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    echo "✅ Docker instalado."
else
    echo "✅ Docker ya estaba instalado."
fi

# 2. Check Repo
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: No se encuentra docker-compose.yml."
    echo "➡️  Asegúrate de estar DENTRO de la carpeta del proyecto (cd crm-pro)."
    exit 1
fi

echo "🔄 Descargando últimos cambios..."
git pull origin main

# 3. Setup Environment
if [ ! -f ".env" ]; then
    echo "⚙️  Detectado entorno nuevo. Creando .env..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo "✅ Archivo .env creado."
    else
        echo "⚠️  No se encontró .env.example. Creando archivo vacío."
        touch .env
    fi
    
    echo "==================================================="
    echo "⚠️  ATENCIÓN: Debes configurar las variables de entorno."
    echo "   Se abrirá el editor 'nano'. Guarda con Ctrl+O y Sal con Ctrl+X."
    echo "==================================================="
    read -p "Presiona ENTER para editar .env..."
    nano .env
fi

# 4. Build and Run
echo "🏗️  Construyendo la aplicación (esto puede tardar unos minutos)..."
# Force cleanup of old attempts
docker compose down --remove-orphans || true

# Build fresh
docker compose build --no-cache

echo "🚀 Levantando servicios..."
docker compose up -d

echo "---------------------------------------------------"
echo "✅ ¡Despliegue finalizado exitosamente!"
echo "📡 Tu CRM debería estar activo en: http://$(curl -s ifconfig.me):3000"
echo "---------------------------------------------------"
echo "📝 Si algo falla, revisa los logs con: docker compose logs -f"
