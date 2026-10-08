#!/usr/bin/env bash
# Roll the stack on the server to a given image tag (a git commit SHA from the deploy
# workflow), wait until it is healthy, and record the tag so it can be rolled back.
#
#   ./deploy/deploy.sh <image-tag>     deploy that tag
#   ./deploy/deploy.sh rollback        go back to the previously deployed tag
#
# Run from the app directory on the server (the one holding docker-compose.yml and .env).
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "deploy: no .env here ($(pwd)) — copy .env.example to .env and fill it in first." >&2
  exit 1
fi

history_file=deploy/.deploy-history
tag="${1:?usage: deploy.sh <image-tag>|rollback}"

if [[ "$tag" == "rollback" ]]; then
  if [[ ! -f "$history_file" ]] || [[ $(wc -l < "$history_file") -lt 2 ]]; then
    echo "deploy: no previous deployment recorded to roll back to." >&2
    exit 1
  fi
  tag=$(tail -n 2 "$history_file" | head -n 1 | cut -d' ' -f2)
  echo "deploy: rolling back to $tag"
  # Note: this restores the previous *code*. Database migrations are not reversed —
  # check DEPLOYMENT.md before rolling back across a release that changed the schema.
fi

# Pin the tag in .env so a plain `docker compose up -d` (or a reboot) keeps running it.
if grep -q '^IMAGE_TAG=' .env; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$tag/" .env
else
  printf '\nIMAGE_TAG=%s\n' "$tag" >> .env
fi
export IMAGE_TAG="$tag"

mkdir -p backups

echo "deploy: pulling images for $tag"
docker compose pull --quiet backend web backup

# Migrate with the new image *before* replacing anything: if a migration fails, the
# currently running version keeps serving and nothing has changed.
echo "deploy: running database migrations"
docker compose up -d --no-build --wait db
docker compose run --rm --no-deps -e MIGRATE_ON_START=false backend alembic upgrade head

echo "deploy: starting stack"
docker compose up -d --no-build --remove-orphans --wait --wait-timeout 180

echo "deploy: checking health"
for _ in $(seq 1 30); do
  if docker compose exec -T backend python -c \
      "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)" \
      >/dev/null 2>&1; then
    echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $tag" >> "$history_file"
    docker image prune -f >/dev/null
    echo "deploy: $tag is live"
    exit 0
  fi
  sleep 2
done

echo "deploy: backend did not become healthy — recent logs:" >&2
docker compose logs --tail 80 backend >&2
exit 1
