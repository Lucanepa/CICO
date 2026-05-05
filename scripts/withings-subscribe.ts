/**
 * Manage Withings notification subscriptions.
 *
 *   pnpm tsx scripts/withings-subscribe.ts https://cico-api.lucanepa.com   # subscribe (appli=1)
 *   pnpm tsx scripts/withings-subscribe.ts list
 *   pnpm tsx scripts/withings-subscribe.ts revoke <callback-url>
 *
 * Requires WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET in env, plus a
 * stored token (run the OAuth flow first via /api/oauth/withings/start).
 */
import postgres from 'postgres'

const NOTIFY_URL = 'https://wbsapi.withings.net/notify'
const TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2'

const clientId = process.env.WITHINGS_CLIENT_ID
const clientSecret = process.env.WITHINGS_CLIENT_SECRET
const dbUrl = process.env.DATABASE_URL
if (!clientId || !clientSecret) throw new Error('WITHINGS_CLIENT_ID / WITHINGS_CLIENT_SECRET required')
if (!dbUrl) throw new Error('DATABASE_URL required')

const APPLI_NEW_WEIGHT = 1

const sql = postgres(dbUrl, { max: 1 })

const row = (await sql`select access_token, refresh_token, expires_at, scope from oauth_tokens where source = 'withings' limit 1`)[0]
if (!row) {
  await sql.end()
  throw new Error('no stored withings token; complete /api/oauth/withings/start first')
}

let accessToken: string = row.access_token
const expiresSoon = row.expires_at && new Date(row.expires_at).getTime() - Date.now() < 60_000
if (expiresSoon && row.refresh_token) {
  const body = new URLSearchParams({
    action: 'requesttoken',
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: row.refresh_token,
  })
  const res = await fetch(TOKEN_URL, { method: 'POST', body })
  const env = (await res.json()) as { status: number; body?: { access_token: string; refresh_token: string; expires_in: number; userid: string | number; scope: string } }
  if (env.status !== 0 || !env.body) throw new Error(`refresh failed: ${env.status}`)
  accessToken = env.body.access_token
  const expiresAt = new Date(Date.now() + env.body.expires_in * 1000)
  await sql`update oauth_tokens
            set access_token = ${env.body.access_token},
                refresh_token = ${env.body.refresh_token},
                expires_at = ${expiresAt},
                scope = ${JSON.stringify({ scope: env.body.scope, userid: String(env.body.userid) })},
                updated_at = now()
            where source = 'withings'`
}

const [, , arg1, arg2] = process.argv

async function call(params: Record<string, string | number>) {
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) body.set(k, String(v))
  const res = await fetch(NOTIFY_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  return res.json()
}

if (arg1 === 'list') {
  console.log(await call({ action: 'list', appli: APPLI_NEW_WEIGHT }))
} else if (arg1 === 'revoke' && arg2) {
  console.log(await call({ action: 'revoke', callbackurl: arg2, appli: APPLI_NEW_WEIGHT }))
} else if (arg1) {
  const callbackurl = new URL('/api/webhooks/withings', arg1).toString()
  console.log(await call({ action: 'subscribe', callbackurl, appli: APPLI_NEW_WEIGHT, comment: 'cico' }))
} else {
  console.error('usage: withings-subscribe.ts <https-base-url> | list | revoke <callback-url>')
  process.exit(1)
}

await sql.end()
