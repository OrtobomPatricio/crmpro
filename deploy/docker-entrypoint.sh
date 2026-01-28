#!/usr/bin/env bash
set -e

# Wait for DB to be potentially ready
echo "[boot] Waiting for database..."
sleep 5

echo "[boot] running DB migrations"
node dist/migrate.js

echo "[boot] starting server"
exec node dist/index.js
