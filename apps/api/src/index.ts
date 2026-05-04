import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import * as Sentry from '@sentry/node'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { startCron } from './cron/prewarm.js'
import { loadEnv } from './lib/env.js'
import { googleOauth } from './oauth/google.js'
import { ouraOauth } from './oauth/oura.js'
import { stravaOauth } from './oauth/strava.js'
import { health } from './routes/health.js'
import { refreshRoute } from './routes/refresh.js'
import { stravaWebhook } from './webhooks/strava.js'

const env = loadEnv()
const app = new Hono()

app.use('*', logger())

app.route('/api/health', health)
app.route('/api/refresh', refreshRoute(env))
app.route('/api/oauth/oura', ouraOauth(env, (k) => process.env[k]))
app.route('/api/oauth/strava', stravaOauth(env, (k) => process.env[k]))
app.route('/api/oauth/google', googleOauth(env, (k) => process.env[k]))
app.route('/api/webhooks/strava', stravaWebhook(env))

app.onError((err, c) => {
  Sentry.captureException(err)
  console.error(err)
  return c.json({ error: 'internal_error' }, 500)
})

if (env.NODE_ENV === 'production') {
  app.use('/*', serveStatic({ root: './public' }))
  app.get('/*', serveStatic({ path: './public/index.html' }))
}

startCron(env)

serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`)
})
