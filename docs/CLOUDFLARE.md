# Cloudflare deploy — `cico.lucanepa.com`

Architecture: split origins.

```
cico.lucanepa.com         →  Cloudflare Pages  (React PWA)
api.cico.lucanepa.com     →  Cloudflare Tunnel →  NAS api container
```

The web is a static SPA on Pages. The Hono API stays on the Synology
NAS behind a Cloudflare Tunnel. Cookies are cross-site (SameSite=None;
Secure); CORS is allow-listed.

---

## 1. DNS records (Cloudflare dashboard → DNS)

| Type   | Name              | Content                                | Proxy |
|--------|-------------------|----------------------------------------|-------|
| CNAME  | `cico`            | `<your-pages-project>.pages.dev`       | ✅    |
| CNAME  | `api.cico`        | `<tunnel-id>.cfargotunnel.com`         | ✅    |

The `api.cico` record is auto-created by the Tunnel UI when you add a
public hostname (step 3). You don't need to add it by hand if you use
the Tunnel UI.

The `cico` CNAME is auto-created by Pages when you add the custom
domain (step 2). Same caveat.

So in practice you don't add DNS rows manually — they appear once
Pages and the Tunnel claim their hostnames.

## 2. Cloudflare Pages — build settings

In the dashboard: **Workers & Pages → Create → Pages → Connect to GitHub → `Lucanepa/CICO`**.

| Field                       | Value                                                          |
|-----------------------------|----------------------------------------------------------------|
| Production branch           | `main`                                                         |
| Framework preset            | `None`                                                         |
| Build command               | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @cico/web build` |
| Build output directory      | `apps/api/public`                                              |
| Root directory              | (leave blank — repo root)                                      |
| Node version                | `22`                                                           |

Build env vars:

| Key                    | Value                              |
|------------------------|------------------------------------|
| `VITE_API_BASE_URL`    | `https://api.cico.lucanepa.com`    |
| `VITE_SENTRY_DSN_WEB`  | (your web Sentry DSN, optional)    |
| `NODE_VERSION`         | `22`                               |

After the first deploy, **Custom domains → Add `cico.lucanepa.com`**.
Cloudflare auto-creates the DNS row.

## 3. Cloudflare Tunnel — public hostname for the API

1. **Zero Trust → Networks → Tunnels** — pick the existing `cico-nas` tunnel (or create one and put `TUNNEL_TOKEN` in `infra/.env`)
2. Click **Public hostnames → Add a public hostname**:
   - Subdomain: `api.cico`
   - Domain: `lucanepa.com`
   - Service type: `HTTP`
   - URL: `api:8787`     ← container DNS inside docker-compose
3. Save. DNS row auto-created.
4. On the NAS, restart the cloudflared container so it picks up the new hostname:
   ```bash
   docker compose -f infra/docker-compose.yml up -d cloudflared
   ```

## 4. NAS env (`infra/.env`)

```env
NODE_ENV=production
WEB_BASE_URL=https://cico.lucanepa.com
ALLOWED_ORIGINS=https://cico.lucanepa.com

OURA_REDIRECT_URI=https://api.cico.lucanepa.com/api/oauth/oura/callback
STRAVA_REDIRECT_URI=https://api.cico.lucanepa.com/api/oauth/strava/callback
GOOGLE_REDIRECT_URI=https://api.cico.lucanepa.com/api/oauth/google/callback
```

…plus the secrets for Postgres/Oura/Strava/Google/Sentry.

## 5. Update the OAuth apps

- **Oura developer portal** — add `https://api.cico.lucanepa.com/api/oauth/oura/callback` to the app's redirect URIs.
- **Strava** — set the Authorization Callback Domain to `api.cico.lucanepa.com`.
- **Google Cloud Console** — add `https://api.cico.lucanepa.com/api/oauth/google/callback` to the OAuth client's authorized redirect URIs.

## 6. Deploy

```bash
# Frontend
git push origin main           # Pages auto-builds and deploys

# Backend (NAS)
ssh nas
cd /volume1/docker/cico
git pull
docker compose -f infra/docker-compose.yml up -d --build api cloudflared
```

## 7. Smoke test

```bash
# API reachable through tunnel
curl https://api.cico.lucanepa.com/api/health

# Frontend serves the SPA
curl -I https://cico.lucanepa.com/

# CORS preflight succeeds
curl -i -X OPTIONS https://api.cico.lucanepa.com/api/today \
  -H "Origin: https://cico.lucanepa.com" \
  -H "Access-Control-Request-Method: GET"
# expect Access-Control-Allow-Origin: https://cico.lucanepa.com
# expect Access-Control-Allow-Credentials: true
```

Open `https://cico.lucanepa.com/`, walk the OAuth flows, watch the
data populate.

## Notes

- **No Cloudflare Pages Functions needed.** Frontend talks directly to the API origin.
- **Webhook URL** for Strava is now `https://api.cico.lucanepa.com/api/webhooks/strava`. Re-register: `pnpm tsx scripts/strava-subscribe.ts https://api.cico.lucanepa.com`.
- **Strava webhook verify token** must match `STRAVA_WEBHOOK_VERIFY_TOKEN` in the NAS env.
- **PWA installability** still works on `cico.lucanepa.com` (HTTPS + manifest + SW).
