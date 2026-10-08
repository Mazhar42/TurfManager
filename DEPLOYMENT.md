# Deploying Turf Manager

This guide takes you from an empty VPS to the live app, and covers what to do afterwards:
updates, rollbacks, backups and restores.

**How it fits together.** GitHub Actions builds three Docker images: the API, Caddy with both
PWAs baked in, and the backup job. It pushes them to GitHub Container Registry (GHCR). The
server never builds anything and never needs the source code. Each deploy copies
`docker-compose.yml` and `deploy/*.sh` to the server over SSH, then runs
`deploy/deploy.sh <commit-sha>`.

Nothing deploys automatically. CI runs on every push. A deploy only happens when you
start the **Deploy** workflow by hand. If you add a required reviewer to the `production`
environment, it also waits for that approval.

---

## 1. What you need

- **A VPS.** Ubuntu 24.04 LTS, 1 vCPU and 2 GB RAM is plenty. Any provider works,
  e.g. Hetzner, DigitalOcean or Vultr. Pick a region close to Bangladesh, such as Singapore.
- **Two DNS names** pointing (A record) at the VPS's IP. One is for the main app
  (`turf.example.com`) and one for the owner app (`owner.turf.example.com`). Caddy gets
  HTTPS certificates for both on first start, so DNS must resolve before you deploy.
- **Admin access** to this GitHub repository.

## 2. Prepare the server (once)

SSH in as root (or a sudo user) and run:

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh

# A dedicated deploy user that can run docker but has no sudo
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy

# App directory
mkdir -p /opt/turfmanager && chown deploy:deploy /opt/turfmanager

# Firewall: SSH + web only. Postgres is never exposed (compose publishes no DB port).
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
```

On a 1–2 GB VPS, also add swap so image pulls and migrations never run out of memory:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Create the production `.env` (once)

As the `deploy` user, create `/opt/turfmanager/.env` from [`.env.example`](.env.example).
Every deploy also copies a fresh `.env.example` next to it for reference.

```bash
sudo -iu deploy
cd /opt/turfmanager
nano .env      # paste .env.example, then fill it in
chmod 600 .env
```

Generate the two secrets with:

```bash
openssl rand -hex 24   # POSTGRES_PASSWORD (hex: URL-safe, it goes into the DB URL)
openssl rand -hex 32   # JWT_SECRET
```

Set `DOMAIN`, `OWNER_DOMAIN` and `CORS_ORIGINS` to your real domains. The API refuses to
start in production with a placeholder secret or with `localhost` origins. That is
deliberate: a placeholder secret would let anyone forge a login token.

**Off-site backups** (strongly recommended): fill in the `BACKUP_RCLONE_REMOTE` and
`RCLONE_CONFIG_*` lines. Any S3-compatible bucket works; Cloudflare R2 and Backblaze B2
both have free tiers that cover this. Give the bucket a lifecycle rule that expires old
objects, e.g. after 90 days.

## 4. Connect GitHub to the server (once)

**An SSH key for deploys.** Run this on your own machine:

```bash
ssh-keygen -t ed25519 -f turf_deploy -N "" -C "github-actions-deploy"
ssh-copy-id -i turf_deploy.pub deploy@<server-ip>
ssh-keyscan -H <server-ip>        # copy this output for VPS_KNOWN_HOSTS
```

**Repository settings → Secrets and variables → Actions:**

| Kind | Name | Value |
|---|---|---|
| Secret | `VPS_HOST` | server IP or hostname |
| Secret | `VPS_USER` | `deploy` |
| Secret | `VPS_SSH_KEY` | contents of `turf_deploy` (the private key) |
| Secret | `VPS_KNOWN_HOSTS` | output of `ssh-keyscan` above (pins the server's identity) |
| Variable | `DOMAIN` | `turf.example.com` (used for the post-deploy smoke test) |
| Variable | `OWNER_DOMAIN` | `owner.turf.example.com` |
| Variable | `VPS_APP_DIR` | optional, default `/opt/turfmanager` |
| Variable | `VPS_PORT` | optional, default `22` |

Then delete `turf_deploy` from your machine, or store it in a password manager.

**Repository settings → Environments → New environment → `production`.** Add yourself as a
*required reviewer*, so every deploy waits for your click.

Images are pushed to GHCR under your account. The deploy job logs the server in with a
token that expires when the job ends, so no registry password is ever stored on the server.

## 5. First deploy

1. On GitHub, open **Actions → Deploy → Run workflow** on `main`.
2. The workflow runs the full CI suite, publishes the images, waits for your approval
   (if you set a reviewer), deploys, and smoke-tests `https://<DOMAIN>/health` on both domains.
3. Create the real venue and the owner's login, once, on the server:

   ```bash
   cd /opt/turfmanager
   docker compose exec backend python -m scripts.bootstrap \
     --venue-name "Green Field Turf" \
     --owner-name "Rafiq" --owner-phone 01712345678 \
     --fields "Field A" "Field B" \
     --opens 06:00 --closes 23:00
   ```

   It asks for the owner's password without echoing it. It refuses to run if a venue
   already exists. The demo seed (`scripts.seed`) refuses to run in production, because
   its passwords are published in the README.

4. Log in as the owner and set up **Settings → Pricing** (weekday, evening and Friday
   rates) and **Settings → Staff**.

## 6. Day to day

| Task | How |
|---|---|
| **Ship an update** | Merge to `main` → **Actions → Deploy → Run workflow** |
| **Roll back** | On the server: `cd /opt/turfmanager && ./deploy/deploy.sh rollback`. Or run `./deploy/deploy.sh <older-sha>` for a specific version; past deploys are listed in `deploy/.deploy-history`. |
| **See logs** | `docker compose logs -f backend` (each line has a `req=` id; the app shows the same id on errors as the `X-Request-ID` header) |
| **Status** | `docker compose ps` |
| **Backup now** | `docker compose run --rm backup now` |
| **List backups** | `ls -lh /opt/turfmanager/backups` |
| **Restore** | `./deploy/restore.sh backups/turfmanager_YYYY-MM-DD_HHMM.dump` (asks you to type `restore`; stops the app during the restore) |
| **Publish images without deploying** | Run the Deploy workflow with *"Only build and push images"* ticked |

**Rollback and the database.** A rollback restores the previous *code*. Database
migrations are not reversed. Migrations in this project only add things, so older code
keeps working. If a release ever removes or renames a column, restore the backup taken
before that deploy.

**Backups** run nightly at 03:30 venue time (`BACKUP_SCHEDULE`, `BACKUP_TZ`). They are kept
for 14 days in `./backups` and copied off-site if configured. **Test a restore** after
going live, e.g. onto a spare VPS or locally. A backup you've never restored is a hope,
not a backup.

**Monitoring.** Point a free uptime checker (UptimeRobot, Better Stack, Healthchecks.io) at
`https://<DOMAIN>/health`. It only returns `200` when the API can reach the database. For
error alerts with stack traces, set `SENTRY_DSN` in `.env` to a Sentry or GlitchTip project,
then redeploy.

**Host updates.** Run `apt update && apt upgrade` monthly and reboot when the kernel
changes. All containers restart automatically after a reboot.

## 7. Before go-live: things code can't check

- [ ] Run the end-to-end walkthrough on a real Android phone, on mobile data: a customer
      calls, staff check availability, book with a ৳500 advance, mark the game completed,
      collect the balance. Then check that the booking shows in today's revenue and in the
      monthly report.
- [ ] Install both PWAs from Chrome ("Add to Home screen") and confirm they open full-screen
      as two separate apps.
- [ ] Run Lighthouse (Chrome DevTools → Lighthouse → Mobile) on both domains.
- [ ] Enter the owner's real fields, hours and rates; delete anything left over from testing.
- [ ] Confirm the first nightly backup appears off-site the next morning, and do one restore.
- [ ] Train the owner and staff. Hand over the logins in person, not over chat.

## Trying the production stack locally

```bash
cp .env.example .env        # set DOMAIN=localhost, OWNER_DOMAIN=owner.localhost,
                            # real-looking secrets, CORS_ORIGINS=["https://localhost","https://owner.localhost"]
docker compose build
docker compose up -d --wait
```

Caddy serves `https://localhost` and `https://owner.localhost` with a locally-trusted
certificate. The compose project is named `turfmanager-prod`, so it doesn't touch the dev
database from `docker-compose.dev.yml`. Remove the repo-root `.env` afterwards; it is
gitignored, but it only belongs on the server.
