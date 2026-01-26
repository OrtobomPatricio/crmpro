#!/bin/bash

# Script de actualización para Imagine CRM Pro (DOCKER version)
# Colores
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== Actualizando Imagine CRM Pro (Docker VPS) ===${NC}"

echo "1. Descargando cambios de GitHub..."
git pull

echo "2. Re-construyendo imagen y reiniciando contenedores..."
# --build fuerza la reconstrucción si hay cambios en el código
# -d corre en segundo plano
docker compose up -d --build

echo "3. Limpiando imágenes antiguas (opcional)..."
docker image prune -f

echo -e "${GREEN}¡Listo! El sistema está actualizado y corriendo.${NC}"
echo "Check de logs: docker compose logs -f app"
