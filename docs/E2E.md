# E2E Test Runbook

A walkthrough you run on your local machine (or the NAS) to verify the
whole pipeline end-to-end. Roughly 30 minutes the first time, 5
minutes per subsequent cycle.

## 0. Prereqs

- Docker / Docker Desktop running (or Podman with a `docker` alias)
- Node 22 + pnpm (`corepack enable pnpm` or `npm i -g pnpm`)
- Oura developer app, Strava developer app, Google Cloud OAuth client
- (optional) USDA FoodData Central API key, ANTHROPIC_API_KEY for OCR

## 1. Boot the database

```bash
cp .env.example .env
# fill in OURA_*, STRAVA_*, GOOGLE_*, GOOGLE_DRIVE_FOLDER_ID,
# USDA_API_KEY, ANTHROPIC_API_KEY, SESSION_SECRET (32+ random bytes)
pnpm install
pnpm compose:up        # starts postgres on 5432
pnpm db:migrate        # runs the 0000_init migration
```

If you ever need to start over: `pnpm compose:down && rm -rf infra/pgdata`.

## 2. Run the stack

In one terminal:

```bash
pnpm dev:api           # http://localhost:8787
```

In a second terminal:

```bash
pnpm dev:web           # http://localhost:5173 (proxies /api → :8787)
```

Hit `http://localhost:8787/api/health` — should return `{ status: "ok" }`.

## 3. Connect data sources

Order doesn't matter; each is independent.

### Oura
1. Visit `http://localhost:8787/api/oauth/oura/start`
2. Approve the app on Oura
3. You'll be redirected to `/?connected=oura`
4. Verify token landed: `psql -h localhost -U cico cico -c 'select source, expires_at from oauth_tokens'`

### Strava
1. In your Strava app settings, set the Authorization Callback Domain to `localhost`
2. Visit `http://localhost:8787/api/oauth/strava/start`
3. Approve, redirect back

### Google Drive (Health Sync)
1. In the Health Sync Android app, configure the destination folder in your Drive
2. Note the folder ID (the trailing path segment of the Drive URL when you open it in browser)
3. Set `GOOGLE_DRIVE_FOLDER_ID` in `.env` and restart the API
4. Visit `http://localhost:8787/api/oauth/google/start`

## 4. First sync

```bash
curl http://localhost:8787/api/refresh | jq
```

Expected response shape:

```json
{
  "ok": true,
  "userId": "…",
  "sources": {
    "oura": { "dailyTotals": 14, "sleep": 14, "workouts": 7 },
    "strava": { "workouts": 12 },
    "huawei": { "filesProcessed": 3, "daysWritten": 14 },
    "dedup": { "clusters": 7, "primariesAssigned": 7, "duplicatesMarked": 5 }
  }
}
```

If a source says `not_connected`, the OAuth step didn't persist a
token — repeat step 3 for that source. `not_configured` means the
client-id/secret env vars are blank.

## 5. Walk the PWA

Open `http://localhost:5173` and verify each view in order:

### Today
- Donut renders with intake (blue) + burn (pink) + a centered net number
- Burn breakdown shows `base · ${huawei|oura}` and the math: base ± base workouts + primary workouts (+ watch-off if applicable)
- Tap "sync" — fetch fires, the donut re-renders

### Activity
- Day-aggregate zone bar populates from primary workout `zone_minutes_jsonb` (Strava workouts only at first; Oura HR samples enable computed zones once present)
- Each primary workout card shows source badge, duration, kcal
- Expand "duplicates" — tap "use this" on a duplicate, the page reloads with that workout pinned as primary; the duplicate's old primary becomes a duplicate of the new one. Re-running `/api/refresh` does NOT undo the pin.

### Workout detail
- Tap a workout from Activity
- HR curve renders (only if HR samples exist for the window — Strava activities with `has_heartrate=true` have streams; Oura workouts also pull HR via `/heartrate`)
- Six zone bands shaded behind the line
- Time-in-zone bar matches the curve

### Food
- Tap "+ add" → search for "apple" — should hit USDA/OFF if local cache is empty
- Try barcode tab with a real EAN (e.g. a Coke can)
- Try photo tab — point camera at a nutrition label, confirm Claude returns macros + warnings
- Try url tab with a recipe blog URL (e.g. a NYT Cooking page)
- Pick a result, set grams, confirm — entry appears in the day list
- Today's net should now reflect the intake

### Trends
- Toggle 7 / 30 / 90 days
- Net balance bars show deficit (green) / surplus (amber)
- Sleep score line plots between 0 and 100
- Z2+ minutes bars show training volume

## 6. Offline & install

1. Hit each main view at least once while online (warms the SW cache)
2. DevTools → Network → throttling → "Offline"
3. Reload — the app should load + show cached Today / Trends / etc.
4. Install banner appears on Chrome/Edge — tap "install", confirms it's a real PWA
5. On iOS: Safari → Share → Add to Home Screen; tap the icon, app opens standalone

## 7. Cron prewarm

The cron schedule runs at `CRON_PREWARM_SCHEDULE` (default `0 3 * * *`
in `Europe/Zurich`). To test now, set it to `*/2 * * * *` in `.env`,
restart the API, watch logs:

```
[cron] scheduled prewarm at "*/2 * * * *" (Europe/Zurich)
[cron] prewarm tick
[cron] oura { dailyTotals: 0, sleep: 0, workouts: 0 }
[cron] strava { workouts: 0 }
[cron] huawei { filesProcessed: 0, daysWritten: 0 }
```

## 8. Strava webhook (optional, requires public URL)

Once deployed behind Cloudflare Tunnel:

```bash
pnpm tsx scripts/strava-subscribe.ts https://health.your-domain
pnpm tsx scripts/strava-subscribe.ts list
```

Finish a Strava activity on your phone → watch the API logs → an
ingest fires for that activity within seconds, no `/api/refresh`
needed.

## 9. NAS deploy

```bash
# On Synology
cd /volume1/docker/cico
git pull
docker compose -f infra/docker-compose.yml up -d --build
docker compose -f infra/docker-compose.yml logs -f api
```

The cloudflared container exposes `api:8787` to your public hostname.
Repeat the OAuth flows there with the production callback URLs.

## 10. Sanity checks

```bash
# row counts per source
psql -h localhost -U cico cico -c "
  select source, count(*)
  from workouts
  group by source;
"

# dedup health: primary workouts per day
psql -h localhost -U cico cico -c "
  select date, count(*) filter (where is_primary) as primaries, count(*) as total
  from workouts
  group by date order by date desc limit 14;
"

# sync errors
psql -h localhost -U cico cico -c "select source, last_run_status, last_error from sync_state;"

# food log totals
psql -h localhost -U cico cico -c "
  select date, sum(kcal) as total_kcal, count(*) as items
  from food_log
  group by date order by date desc limit 14;
"
```
