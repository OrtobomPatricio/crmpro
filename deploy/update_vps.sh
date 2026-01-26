#!/bin/bash

# Colores
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Actualizando Imagine CRM (Servidor VPS) ===${NC}"

echo "1. Descargando cambios..."
git pull

echo "2. Instalando dependencias..."
pnpm install

echo "3. Ejecutando migraciones de Base de Datos..."
pnpm db:push

echo "4. Construyendo aplicación..."
# Aseguramos que las variables de entorno necesarias para el build estén presentes
# (Ajusta VITE_DEV_BYPASS_AUTH=0 si en VPS usas login real)
# export VITE_DEV_BYPASS_AUTH=1 (Comentado por seguridad en producción)
pnpm run build

echo "5. Reiniciando servicio..."
# Asumiendo que usas PM2 para gestionar el proceso node
pm2 reload all || pm2 restart all

echo -e "${GREEN}¡Listo! El CRM está actualizado.${NC}"
