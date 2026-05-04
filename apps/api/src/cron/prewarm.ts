import cron from 'node-cron'
import * as Sentry from '@sentry/node'

export function startCron(schedule: string) {
  if (!cron.validate(schedule)) {
    throw new Error(`invalid cron expression: ${schedule}`)
  }
  cron.schedule(
    schedule,
    async () => {
      try {
        console.log('[cron] prewarm tick')
        // TODO: oura.syncSince, drive.scanForCsvs, strava.syncSince
      } catch (err) {
        Sentry.captureException(err)
        console.error('[cron] prewarm failed', err)
      }
    },
    { timezone: process.env.TZ ?? 'Europe/Zurich' },
  )
  console.log(`[cron] scheduled prewarm at "${schedule}"`)
}
