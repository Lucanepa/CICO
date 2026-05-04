# CICO

Calories in, calories out — personal health dashboard fusing Oura, Huawei Band
(via Health Sync → Google Drive CSVs), Strava, and Frontier X into a single
PWA. Self-hosted on a Synology NAS behind Cloudflare Tunnel.

## Stack

- **API:** Hono on Node 22 (`apps/api`)
- **Web:** React 19 + Vite 6 PWA (`apps/web`)
- **DB:** PostgreSQL 17 + Drizzle ORM (`packages/db`)
- **Shared:** Zod + types (`packages/shared`)
- **Infra:** Docker Compose + Cloudflare Tunnel (`infra/`)
- **Errors:** Sentry on both API and web
- **Cron:** embedded `node-cron` in the API process (03:00 UTC pre-warm)

## Layout

```
apps/
  api/   # Hono server, OAuth, sync, cron, REST
  web/   # React PWA
packages/
  shared/  # types, zod, zone math
  db/      # Drizzle schema + migrations + client
  config/  # shared tsconfig
infra/
  docker-compose.yml
  cloudflared/
```

## Quick start (local dev)

```bash
cp .env.example .env
pnpm install
pnpm compose:up                 # postgres
pnpm db:generate                # drizzle-kit: schema -> SQL
pnpm db:migrate                 # apply migrations
pnpm dev:api                    # http://localhost:8787
pnpm dev:web                    # http://localhost:5173
```

## Production (NAS)

```bash
cd /volume1/docker/cico
cp .env.example .env             # fill secrets
docker compose -f infra/docker-compose.yml up -d --build
```

The `cloudflared` container exposes `api:8787` to your public hostname.
See `infra/cloudflared/README.md`.

## Build order

See the spec. Step 1 (this commit) is the scaffold. Next: step 3 — Oura
OAuth + on-demand sync.
