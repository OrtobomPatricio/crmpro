#!/usr/bin/env bash
set -e

# Wait for DB to be potentially ready
echo "[boot] Waiting for database..."
sleep 5

echo "[boot] running DB migrations"
node dist/migrate.js

echo "[boot] bootstrapping admin user..."
export BOOTSTRAP_ADMIN_EMAIL=admin@crm.com
export BOOTSTRAP_ADMIN_PASSWORD=123456
node dist/bootstrap-admin.js || echo "Admin creation skipped (likely already exists)"

echo "[boot] starting server"
exec node dist/index.js
