#!/bin/sh
# One backup: custom-format pg_dump (restore with deploy/restore.sh), prune old local
# dumps, then copy off-box if an rclone remote is configured.
set -eu

: "${POSTGRES_HOST:=db}"
: "${BACKUP_DIR:=/backups}"
: "${BACKUP_KEEP_DAYS:=14}"

stamp=$(date +%Y-%m-%d_%H%M)
file="$BACKUP_DIR/turfmanager_$stamp.dump"

PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
  --host "$POSTGRES_HOST" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --format custom --compress 9 --file "$file.partial"
mv "$file.partial" "$file"
echo "backup: wrote $file ($(du -h "$file" | cut -f1))"

find "$BACKUP_DIR" -name 'turfmanager_*.dump' -type f -mtime +"$BACKUP_KEEP_DAYS" -print -delete \
  | sed 's/^/backup: pruned /'

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy --no-traverse "$file" "$BACKUP_RCLONE_REMOTE"
  echo "backup: copied to $BACKUP_RCLONE_REMOTE"
fi
