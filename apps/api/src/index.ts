import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import * as Sentry from '@sentry/node'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { startCron } from './cron/prewarm.js'
import { requireDirectusAuth } from './lib/auth.js'
import { loadEnv } from './lib/env.js'
import { googleOauth } from './oauth/google.js'
import { ouraOauth } from './oauth/oura.js'
import { stravaOauth } from './oauth/strava.js'
import { withingsOauth } from './oauth/withings.js'
import { bodyRoute } from './routes/body.js'
import { fitnessRoute } from './routes/fitness.js'
import { integrationsRoute } from './routes/integrations.js'
import { foodLogRoute } from './routes/food-log.js'
import { foodsRoute } from './routes/foods.js'
import { health } from './routes/health.js'
import { refreshRoute } from './routes/refresh.js'
import { todayRoute } from './routes/today.js'
import { trendsRoute } from './routes/trends.js'
import { workoutsRoute } from './routes/workouts.js'
import { stravaWebhook } from './webhooks/strava.js'
import { withingsWebhook } from './webhooks/withings.js'

const env = loadEnv()
const app = new Hono()

app.use('*', logger())

if (env.ALLOWED_ORIGINS) {
  const origins = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
  app.use(
    '/api/*',
    cors({
      origin: (origin) => (origins.includes(origin) ? origin : null),
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['content-type', 'authorization'],
      maxAge: 600,
    }),
  )
}

app.use('/api/*', requireDirectusAuth(env))

app.route('/api/health', health)
app.route('/api/refresh', refreshRoute(env))
app.route('/api/today', todayRoute(env))
app.route('/api/foods', foodsRoute(env))
app.route('/api/food-log', foodLogRoute(env))
app.route('/api/workouts', workoutsRoute(env))
app.route('/api/trends', trendsRoute(env))
app.route('/api/body', bodyRoute(env))
app.route('/api/fitness', fitnessRoute(env))
app.route('/api/integrations', integrationsRoute(env))
app.route('/api/oauth/oura', ouraOauth(env, (k) => process.env[k]))
app.route('/api/oauth/strava', stravaOauth(env, (k) => process.env[k]))
app.route('/api/oauth/google', googleOauth(env, (k) => process.env[k]))
app.route('/api/oauth/withings', withingsOauth(env, (k) => process.env[k]))
app.route('/api/webhooks/strava', stravaWebhook(env))
app.route('/api/webhooks/withings', withingsWebhook(env))

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
