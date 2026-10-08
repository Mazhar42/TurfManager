# Turf Manager

A booking, customer, payment and reporting system for a football turf — built as an
internal operations tool for the owner and staff, delivered as a mobile-first PWA over a
FastAPI + PostgreSQL backend.

The one rule the whole system is built around: **double-booking is structurally
impossible.** It's enforced by a PostgreSQL `EXCLUDE` constraint on a GiST index, not by
application logic — see [`backend/app/models/booking.py`](backend/app/models/booking.py)
and the concurrency tests in
[`backend/tests/test_concurrency.py`](backend/tests/test_concurrency.py).

There are **two PWAs**, both talking to the same backend:

- **`frontend/`** — the full operational app for staff and owners: the Today screen,
  quick booking, bookings/customers/payments, and (owner-only) reports and settings. This
  is the front-desk tool, built for running the business day to day.
- **`frontend-owner/`** — a small, read-only companion app for the owner/manager: today's
  revenue at a glance, the day's schedule, this month's numbers, outstanding dues. No
  booking creation, no editing — just a fast check from a phone. It intentionally does
  *not* duplicate `frontend/`'s feature set; for anything beyond viewing, it points back
  to the main app. It's a **separate installable PWA** (its own name, icon and origin) so
  it doesn't collide with the main app if both are installed on the same phone.

## Stack

- **Backend** — FastAPI, SQLAlchemy 2.0, PostgreSQL 16, Alembic, JWT auth (access + rotating
  refresh tokens). Sync SQLAlchemy on purpose — see `backend/app/db/session.py`.
- **Frontend(s)** — React 19, Vite, TypeScript, Tailwind CSS v4, TanStack Query, Recharts,
  `vite-plugin-pwa`. Mobile-first, installable, dark mode. `frontend-owner/` is the same
  stack, deliberately kept lighter (no forms/mutation libraries — it has no writes).
- **Deploy** — Docker Compose on a VPS (Postgres + backend + Caddy serving both built
  frontends on their own domains + a nightly backup job). Images are built by GitHub Actions
  and pushed to GHCR; deploys are manual, one click. See **[DEPLOYMENT.md](DEPLOYMENT.md)**.

## Project layout

```
backend/         FastAPI app — app/{models,schemas,services,api/v1}, alembic/, tests/,
                 scripts/seed.py (demo data, dev only), scripts/bootstrap.py (real venue, production)
frontend/        Staff + owner operational PWA — src/{app,features,components,lib}
frontend-owner/  Owner/manager read-only companion PWA — same shape, smaller surface
deploy/          deploy.sh / restore.sh (run on the server), web/ (Caddy + both PWAs image),
                 backup/ (nightly pg_dump + optional off-site copy image)
.github/workflows/  ci.yml (every push/PR), deploy.yml (manual: publish images + deploy to VPS)
docker-compose.yml       production stack — see DEPLOYMENT.md
docker-compose.dev.yml   local dev: just Postgres in a container
Caddyfile                reverse proxy config — two site blocks, one per frontend
.env.example             production settings template (the server's .env)
```

## Local development

### 1. Database

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts Postgres on **port 5433** (5432 is commonly taken by another local project —
adjust the port mapping in `docker-compose.dev.yml` if that's not the case for you, and
`backend/.env`'s `DATABASE_URL` to match).

Create the dev and test databases once:

```bash
docker exec <container> psql -U turf -d postgres -c "CREATE DATABASE turfmanager;"
docker exec <container> psql -U turf -d postgres -c "CREATE DATABASE turfmanager_test;"
```

(`turfmanager` is created automatically by the Postgres image on first boot via
`POSTGRES_DB`; only `turfmanager_test` needs the manual step.)

### 2. Backend

```bash
cd backend
uv sync --extra dev
cp .env.example .env   # if you don't already have one; see below for the shape
uv run alembic upgrade head
uv run python -m scripts.seed        # demo venue, fields, pricing, bookings, customers
uv run uvicorn app.main:app --reload --port 8010
```

`backend/.env` (this is exactly `backend/.env.example`):

```
DATABASE_URL=postgresql+psycopg://turf:turf@localhost:5433/turfmanager
JWT_SECRET=dev-secret-not-for-production
ENVIRONMENT=development
```

With `ENVIRONMENT=development` the interactive API docs are at
`http://localhost:8010/api/v1/docs` and the schema at `/api/v1/openapi.json` (both are
switched off in production).

Seeded logins: **owner** `01700000000` / `owner12345`, **staff** `01711111111` /
`staff12345`.

Run the tests (against `turfmanager_test`, migrated fresh each session):

```bash
uv run pytest -q
```

The concurrency tests are the ones that matter — they prove two simultaneous booking
attempts on the same slot can never both succeed, at the database level.

### 3. Frontend — main app (staff + full owner access)

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173`; its dev server proxies `/api` to
`http://127.0.0.1:8010` (see `vite.config.ts`) — adjust if your backend runs elsewhere.

Type-check and production build:

```bash
npx tsc -b
npm run build
```

### 4. Frontend — owner companion app

```bash
cd frontend-owner
npm install
npm run dev
```

Opens on `http://localhost:5174` (proxies `/api` to the same backend on `8010`). **Log in
with the seeded owner account** (`01700000000` / `owner12345`) — this app rejects
non-owner logins outright; a staff account gets a clear "this app is for owners and
managers" message instead of getting in. Same type-check/build commands as above.

Run both frontends at once (two terminals, or two backgrounded `npm run dev`) alongside
the backend to see them side by side — they're independent Vite dev servers on different
ports, hitting the same API.

## Production deploy

Everything — VPS setup, GitHub secrets, first deploy, creating the real venue, rollbacks,
backups and restores — is in **[DEPLOYMENT.md](DEPLOYMENT.md)**. In short:

- **CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every push and PR:
  ruff + pytest against real PostgreSQL, lint + type-check + build of both PWAs, ShellCheck,
  and a build of all three production images.
- **Deploy** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) is manual
  (*Actions → Deploy → Run workflow*): CI again → images pushed to GHCR tagged with the
  commit SHA → `deploy/deploy.sh` on the VPS over SSH (pull, migrate, restart, wait for
  health) → smoke test of both domains.
- Two separate origins is deliberate, not incidental — a PWA's installability, icon and
  manifest are scoped to its origin, so this is what lets an owner install "Turf Manager"
  and "Turf Owner" as two distinct icons on the same home screen instead of one
  overwriting the other.

## Notes for whoever picks this up next

- **Timezones**: every stored timestamp is UTC (`timestamptz`); the venue carries its own
  IANA timezone (`Asia/Dhaka` by default) and all business logic (opening hours, pricing
  windows, day boundaries in reports) works in venue-local time. A timestamp with no
  timezone offset sent to the API is *assumed* to already be venue-local — see
  `localize()` in `backend/app/services/booking.py`. The frontend's quick-booking form
  relies on this: it sends a plain local wall-clock string rather than converting through
  the browser's own timezone.
- **Payment status is derived, never stored** — see `backend/app/services/payments.py`.
  There is no `payment_status` column to drift out of sync with the payments ledger.
- **Money** is `Decimal`/`NUMERIC(12,2)` end to end. Never introduce a `float` for it.
- **`frontend-owner/` is read-only by design** — it only calls `GET` endpoints (plus
  `/auth/*`). If it ever needs a write (e.g. approving something from the phone), add the
  mutation deliberately and re-examine whether it still belongs in this app or in
  `frontend/` — don't let it drift into a second copy of the full app by accretion.
- **Concurrency**: when two bookings race for the same slot, Postgres rejects the loser
  either with an exclusion violation *or* (under a true simultaneous insert) a deadlock
  error. `_is_slot_conflict()` in `services/booking.py` maps both to `409 SLOT_TAKEN`;
  `test_many_simultaneous_bookings_never_500` keeps it that way.
- **Audit trail**: every create / status change / reschedule / reprice / payment writes a
  `booking_events` row with the acting user; `GET /bookings/{id}` returns them as `events`
  and the booking detail screen shows them as History.
- **Production guard rails**: the API refuses to start with `ENVIRONMENT=production` and a
  placeholder `JWT_SECRET` or localhost CORS origins; `scripts.seed` refuses to run in
  production; failed logins are throttled per phone number and per IP (`429 TOO_MANY_ATTEMPTS`).
- Full build plan and rationale: see the original plan this repo was built from if you
  still have it (`~/.claude/plans/`), or read the module docstrings — `booking.py`,
  `payments.py` and the `bookings` migration explain the "why" inline rather than in a
  separate design doc.
