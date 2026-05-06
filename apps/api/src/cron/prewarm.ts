import cron from 'node-cron'
import * as Sentry from '@sentry/node'
import { db } from '../lib/db.js'
import type { Env } from '../lib/env.js'
import { loadHrSettings } from '../lib/hr-settings.js'
import { getOrCreateDefaultUser } from '../lib/user.js'
import { OuraNotConnectedError } from '../sync/oura/client.js'
import { syncOura } from '../sync/oura/index.js'
import { StravaNotConnectedError } from '../sync/strava/client.js'
import { syncStrava } from '../sync/strava/index.js'
import { GoogleNotConnectedError, syncHealthSync } from '../sync/healthsync/index.js'
import { WithingsNotConnectedError } from '../sync/withings/client.js'
import { syncWithings } from '../sync/withings/index.js'

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
        const hr = await loadHrSettings(database, userId)

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

        if (env.STRAVA_CLIENT_ID && env.STRAVA_CLIENT_SECRET) {
          try {
            const result = await syncStrava(
              database,
              { clientId: env.STRAVA_CLIENT_ID, clientSecret: env.STRAVA_CLIENT_SECRET },
              userId,
              hr,
            )
            console.log('[cron] strava', result)
          } catch (err) {
            if (!(err instanceof StravaNotConnectedError)) throw err
          }
        }

        if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
          try {
            const result = await syncHealthSync(
              database,
              { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
              userId,
              env.GOOGLE_DRIVE_FOLDER_ID ?? '',
            )
            console.log('[cron] huawei', result)
          } catch (err) {
            if (!(err instanceof GoogleNotConnectedError)) throw err
          }
        }

        if (env.WITHINGS_CLIENT_ID && env.WITHINGS_CLIENT_SECRET) {
          try {
            const result = await syncWithings(
              database,
              { clientId: env.WITHINGS_CLIENT_ID, clientSecret: env.WITHINGS_CLIENT_SECRET },
              userId,
            )
            console.log('[cron] withings', result)
          } catch (err) {
            if (!(err instanceof WithingsNotConnectedError)) throw err
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
