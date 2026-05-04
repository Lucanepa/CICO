import { index, integer, pgTable, smallint, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const heartRateSamples = pgTable(
  'heart_rate_samples',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    timestamp: timestamp({ withTimezone: true }).notNull(),
    bpm: smallint().notNull(),
    source: text().notNull(),
  },
  (t) => ({
    userTsIdx: index('hr_user_ts_idx').on(t.userId, t.timestamp),
  }),
)

export const heartRateMinuteAggregates = pgTable(
  'heart_rate_minute_aggregates',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    minute: timestamp({ withTimezone: true }).notNull(),
    avgBpm: smallint('avg_bpm').notNull(),
    minBpm: smallint('min_bpm').notNull(),
    maxBpm: smallint('max_bpm').notNull(),
    sampleCount: integer('sample_count').notNull(),
    source: text().notNull(),
  },
  (t) => ({
    userMinuteIdx: index('hr_min_user_minute_idx').on(t.userId, t.minute),
  }),
)
