import { eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

export type HrSettings = { age: number; maxHrOverride?: number }

const FALLBACK_AGE = 30

export async function loadHrSettings(db: Database, userId: string): Promise<HrSettings> {
  const rows = await db
    .select({ settings: schema.users.settingsJsonb })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1)
  const settings = rows[0]?.settings ?? {}
  const now = new Date().getUTCFullYear()
  const age = settings.birthYear ? now - settings.birthYear : FALLBACK_AGE
  const out: HrSettings = { age }
  if (settings.maxHrOverride) out.maxHrOverride = settings.maxHrOverride
  return out
}
