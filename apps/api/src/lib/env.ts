import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  TZ: z.string().default('Europe/Zurich'),
  SENTRY_DSN_API: z.string().optional(),
  CRON_PREWARM_SCHEDULE: z.string().default('0 3 * * *'),
  DEFAULT_USER_EMAIL: z.string().email().default('me@cico.local'),

  OURA_CLIENT_ID: z.string().optional(),
  OURA_CLIENT_SECRET: z.string().optional(),
  OURA_REDIRECT_URI: z.string().optional(),

  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_REDIRECT_URI: z.string().optional(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  return envSchema.parse(process.env)
}
