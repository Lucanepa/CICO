import cron from 'node-cron'
import * as Sentry from '@sentry/node'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { OuraNotConnectedError } from '../sync/oura/client.js'
import { syncOura } from '../sync/oura/index.js'

export function startCron(env: Env) {
  const schedule = env.CRON_PREWARM_SCHEDULE
  if (!cron.validate(schedule)) {
    throw new Error(`invalid cron expression: ${schedule}`)
  }
  cron.schedule(
    schedule,
    async () => {
      console.log('[cron] prewarm tick')
      try {
        const database = db(env.DATABASE_URL)
        const userId = await getOrCreateDefaultUser(database, env.DEFAULT_USER_EMAIL)
        if (env.OURA_CLIENT_ID && env.OURA_CLIENT_SECRET) {
          try {
            const result = await syncOura(
              database,
              { clientId: env.OURA_CLIENT_ID, clientSecret: env.OURA_CLIENT_SECRET },
              userId,
            )
            console.log('[cron] oura', result)
          } catch (err) {
            if (!(err instanceof OuraNotConnectedError)) throw err
          }
        }
      } catch (err) {
        Sentry.captureException(err)
        console.error('[cron] prewarm failed', err)
      }
    },
    { timezone: env.TZ },
  )
  console.log(`[cron] scheduled prewarm at "${schedule}" (${env.TZ})`)
}
