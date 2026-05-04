import { eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

export type StoredToken = {
  source: string
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scope: string | null
}

export async function saveToken(
  db: Database,
  source: string,
  token: {
    accessToken: string
    refreshToken?: string | null
    expiresAt?: Date | null
    scope?: string | null
  },
): Promise<void> {
  await db
    .insert(schema.oauthTokens)
    .values({
      source,
      accessToken: token.accessToken,
      refreshToken: token.refreshToken ?? null,
      expiresAt: token.expiresAt ?? null,
      scope: token.scope ?? null,
    })
    .onConflictDoUpdate({
      target: schema.oauthTokens.source,
      set: {
        accessToken: token.accessToken,
        refreshToken: token.refreshToken ?? null,
        expiresAt: token.expiresAt ?? null,
        scope: token.scope ?? null,
        updatedAt: new Date(),
      },
    })
}

export async function loadToken(db: Database, source: string): Promise<StoredToken | null> {
  const rows = await db
    .select()
    .from(schema.oauthTokens)
    .where(eq(schema.oauthTokens.source, source))
    .limit(1)
  const row = rows[0]
  if (!row) return null
  return {
    source: row.source,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken,
    expiresAt: row.expiresAt,
    scope: row.scope,
  }
}
