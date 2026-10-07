# syntax=docker/dockerfile:1
# Builds both PWAs and bakes them, with the Caddyfile, into one Caddy image. Build context
# is the repo root:  docker build -f deploy/web/Dockerfile .
FROM node:24-alpine AS main-app
WORKDIR /src
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM node:24-alpine AS owner-app
WORKDIR /src
COPY frontend-owner/package.json frontend-owner/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend-owner/ ./
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=main-app /src/dist /srv/frontend
COPY --from=owner-app /src/dist /srv/frontend-owner
