import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const syncState = pgTable('sync_state', {
  source: text().primaryKey(),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastError: text('last_error'),
  lastRunStatus: text('last_run_status'),
})

export const oauthTokens = pgTable('oauth_tokens', {
  source: text().primaryKey(),
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scope: text(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
