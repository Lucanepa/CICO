import { date, integer, jsonb, pgTable, real, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const sleepSessions = pgTable('sleep_sessions', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date().notNull(),
  source: text().notNull(),
  totalMin: integer('total_min'),
  deepMin: integer('deep_min'),
  remMin: integer('rem_min'),
  lightMin: integer('light_min'),
  efficiency: real(),
  hrvAvg: real('hrv_avg'),
  score: integer(),
  rawPayloadJsonb: jsonb('raw_payload_jsonb'),
})
