#!/usr/bin/env sh
set -e

if [ "${RUN_MIGRATIONS:-1}" = "1" ]; then
  echo "[boot] running DB migrations"
  pnpm db:migrate
fi

echo "[boot] starting server"
exec "$@"
