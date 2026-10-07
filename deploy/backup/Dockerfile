# syntax=docker/dockerfile:1
# Nightly pg_dump of the turf database, kept locally for BACKUP_KEEP_DAYS and optionally
# copied off the server with rclone (S3, Backblaze B2, Cloudflare R2, Google Drive, ...).
FROM postgres:16-alpine
RUN apk add --no-cache rclone tzdata
COPY backup.sh entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
