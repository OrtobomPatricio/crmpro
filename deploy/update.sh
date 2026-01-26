#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/chin-crm}"
APP_NAME="${APP_NAME:-chin-crm}"

cd "$APP_DIR"

echo "[1/5] git pull"
git pull

echo "[2/5] pnpm install"
pnpm install

echo "[3/5] pnpm db:migrate"
pnpm db:migrate

echo "[4/5] pnpm build"
pnpm build

echo "[5/5] pm2 restart"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$APP_NAME"
else
  pm2 start deploy/pm2.ecosystem.config.cjs
fi

pm2 save

echo "✅ Actualizado y reiniciado"
