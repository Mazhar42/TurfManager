#!/bin/sh
# Bring the schema up to date before starting (Alembic is a no-op when already at head),
# so a fresh server or a plain `docker compose up -d` never runs code against an old schema.
set -e
if [ "${MIGRATE_ON_START:-true}" = "true" ]; then
  alembic upgrade head
fi
exec "$@"
