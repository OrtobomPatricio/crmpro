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
    echo "⚙️  Detectado entorno nuevo. Generando configuración segura AUTOMÁTICA..."
    
    # Geneacion de secretos
    JWT_SEC=$(openssl rand -hex 32)
    ENC_KEY=$(openssl rand -hex 32)
    DB_PASS=$(openssl rand -hex 16)
    
    # Detectar IP Publica
    PUBLIC_IP=$(curl -s ifconfig.me || echo "localhost")
    
    cat <<EOF > .env
# ==========================================
# CONFIGURACIÓN PRODUCCIÓN (GENERADA AUTO)
# ==========================================
NODE_ENV=production
# Conexion interna docker
DATABASE_URL=mysql://root:\${DB_PASS}@mysql:3306/chin_crm

# --- SEGURIDAD ---
JWT_SECRET=\${JWT_SEC}
DATA_ENCRYPTION_KEY=\${ENC_KEY}

# --- USUARIO ADMIN ---
# Valor temporal para permitir el arranque.
# Despues de loguearte, cambia esto por tu ID real.
OWNER_OPEN_ID=admin-temporal

# --- OPCIONES ---
ALLOW_DEV_LOGIN=0
VITE_DEV_BYPASS_AUTH=0

# --- DB ---
DB_USER=root
DB_PASS=\${DB_PASS}
DB_NAME=chin_crm
MYSQL_ROOT_PASSWORD=\${DB_PASS}

# --- DOMINIO / IP ---
VITE_OAUTH_PORTAL_URL=http://\${PUBLIC_IP}:3000
OAUTH_SERVER_URL=http://\${PUBLIC_IP}:3000
EOF

    echo "✅ Archivo .env generado con contraseñas seguras."
    echo "🔑 Tu contraseña de base de datos es: \${DB_PASS}"
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
