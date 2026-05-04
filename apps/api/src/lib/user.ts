import { eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

export async function getOrCreateDefaultUser(db: Database, email: string): Promise<string> {
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1)
  if (existing[0]) return existing[0].id
  const inserted = await db
    .insert(schema.users)
    .values({ email, settingsJsonb: {} })
    .returning({ id: schema.users.id })
  if (!inserted[0]) throw new Error('failed to create user')
  return inserted[0].id
}
