import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().default(8787),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  TZ: z.string().default('Europe/Zurich'),
  SENTRY_DSN_API: z.string().optional(),
  CRON_PREWARM_SCHEDULE: z.string().default('0 3 * * *'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  return envSchema.parse(process.env)
}
