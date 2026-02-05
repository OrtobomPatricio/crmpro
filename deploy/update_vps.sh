#!/bin/bash

# Colores
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Actualizando Imagine CRM (Servidor VPS - Docker) ===${NC}"

echo "1. Descargando cambios..."
git pull

echo "2. Re-construyendo imagen y reiniciando contenedores..."
# --build fuerza la reconstrucción si hay cambios en el código
# -d corre en segundo plano
docker compose up -d --build

echo "3. Limpiando imágenes antiguas (opcional)..."
docker image prune -f

echo -e "${GREEN}¡Listo! El CRM está actualizado y corriendo.${NC}"
echo "Check de logs: docker compose logs -f app"
