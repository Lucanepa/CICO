/**
 * One-time Strava webhook subscription. Run after deploying so Strava
 * has a publicly reachable callback URL.
 *
 *   pnpm tsx scripts/strava-subscribe.ts https://health.example.com
 *
 * Lists existing subscriptions if the verb is `list`, deletes if `delete <id>`.
 */
const SUB_URL = 'https://www.strava.com/api/v3/push_subscriptions'

const clientId = process.env.STRAVA_CLIENT_ID
const clientSecret = process.env.STRAVA_CLIENT_SECRET
const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
if (!clientId || !clientSecret) throw new Error('STRAVA_CLIENT_ID/SECRET required')

const [, , arg1, arg2] = process.argv

if (arg1 === 'list') {
  const url = new URL(SUB_URL)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  const res = await fetch(url)
  console.log(await res.json())
} else if (arg1 === 'delete' && arg2) {
  const url = new URL(`${SUB_URL}/${arg2}`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  const res = await fetch(url, { method: 'DELETE' })
  console.log(res.status, await res.text())
} else if (arg1) {
  if (!verifyToken) throw new Error('STRAVA_WEBHOOK_VERIFY_TOKEN required')
  const callbackUrl = new URL('/api/webhooks/strava', arg1).toString()
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  })
  const res = await fetch(SUB_URL, { method: 'POST', body })
  console.log(res.status, await res.json())
} else {
  console.error('usage: strava-subscribe.ts <https-base-url> | list | delete <id>')
  process.exit(1)
}
