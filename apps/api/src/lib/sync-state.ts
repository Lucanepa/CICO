import { eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

export async function getLastSync(db: Database, source: string): Promise<Date | null> {
  const rows = await db
    .select()
    .from(schema.syncState)
    .where(eq(schema.syncState.source, source))
    .limit(1)
  return rows[0]?.lastSyncedAt ?? null
}

export async function markSyncSuccess(db: Database, source: string, at: Date = new Date()) {
  await db
    .insert(schema.syncState)
    .values({ source, lastSyncedAt: at, lastError: null, lastRunStatus: 'ok' })
    .onConflictDoUpdate({
      target: schema.syncState.source,
      set: { lastSyncedAt: at, lastError: null, lastRunStatus: 'ok' },
    })
}

export async function markSyncError(db: Database, source: string, err: unknown) {
  await db
    .insert(schema.syncState)
    .values({
      source,
      lastSyncedAt: null,
      lastError: errorMessage(err),
      lastRunStatus: 'error',
    })
    .onConflictDoUpdate({
      target: schema.syncState.source,
      set: { lastError: errorMessage(err), lastRunStatus: 'error' },
    })
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
