#!/bin/sh
# Schedules backup.sh with busybox crond. Cron jobs start with an empty environment, so
# the container's environment is snapshotted to a file each job sources first.
set -eu

: "${BACKUP_SCHEDULE:=30 3 * * *}"   # 03:30 every night, in $TZ (venue time by default)

export -p > /etc/backup.env
chmod 600 /etc/backup.env

echo "$BACKUP_SCHEDULE . /etc/backup.env; /usr/local/bin/backup.sh > /proc/1/fd/1 2>&1" > /etc/crontabs/root
echo "backup: scheduled '$BACKUP_SCHEDULE' (TZ=${TZ:-UTC}), keeping ${BACKUP_KEEP_DAYS:-14} days locally${BACKUP_RCLONE_REMOTE:+, copying to $BACKUP_RCLONE_REMOTE}"

if [ "${1:-}" = "now" ]; then
  exec /usr/local/bin/backup.sh
fi

exec crond -f -l 8
