#!/usr/bin/env bash
set -e

echo "[boot] running DB migrations"
node dist/migrate.js

echo "[boot] starting server"
exec node dist/index.js
