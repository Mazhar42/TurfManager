#!/usr/bin/env bash
# Restore the database from a backup dump. DESTRUCTIVE: replaces all current data.
#
#   ./deploy/restore.sh backups/turfmanager_2026-10-08_0330.dump
#
# Take a fresh backup first if the current data might still matter:
#   docker compose run --rm backup now
set -euo pipefail

cd "$(dirname "$0")/.."
dump="${1:?usage: restore.sh <path-to-.dump-file>}"
[[ -f "$dump" ]] || { echo "restore: $dump not found" >&2; exit 1; }

env_value() { grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true; }
POSTGRES_USER=$(env_value POSTGRES_USER); POSTGRES_USER=${POSTGRES_USER:-turf}
POSTGRES_DB=$(env_value POSTGRES_DB); POSTGRES_DB=${POSTGRES_DB:-turfmanager}

read -r -p "This REPLACES all data in '$POSTGRES_DB' with $dump. Type 'restore' to continue: " answer
[[ "$answer" == "restore" ]] || { echo "restore: cancelled"; exit 1; }

echo "restore: stopping the app so nothing writes during the restore"
docker compose stop web backend

docker compose exec -T db pg_restore --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --clean --if-exists --no-owner --single-transaction < "$dump"

echo "restore: starting the app again"
docker compose up -d --no-build --wait backend web
echo "restore: done"
