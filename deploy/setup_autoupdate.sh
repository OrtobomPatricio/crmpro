#!/bin/bash

# Este script configura una tarea automática (Cron) para actualizar el CRM todas las noches.
# Uso: ./setup_autoupdate.sh

CURRENT_DIR=$(pwd)
UPDATE_SCRIPT="$CURRENT_DIR/update_vps.sh"
LOG_FILE="$CURRENT_DIR/update_log.txt"

# Verificar que el script de actualización existe
if [ ! -f "$UPDATE_SCRIPT" ]; then
    echo "Error: No encuentro 'update_vps.sh' en este directorio."
    exit 1
fi

# Dar permisos de ejecución
chmod +x "$UPDATE_SCRIPT"

# Crear la entrada del cron (3:00 AM todos los días)
# Se usa crontab -l para listar existentes, y se añade la nueva línea
CRON_JOB="0 3 * * * $UPDATE_SCRIPT >> $LOG_FILE 2>&1"

(crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -

echo "============================================"
echo "✅ Actualización Automática Configurada"
echo "============================================"
echo "El sistema buscará actualizaciones todos los días a las 03:00 AM."
echo "Los logs se guardarán en: $LOG_FILE"
echo "Si tú subes cambios a GitHub, el cliente los recibirá automáticamente esa madrugada."
