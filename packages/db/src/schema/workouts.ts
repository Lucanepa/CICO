import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import type { ZoneMinutes } from '@cico/shared'
import { users } from './users.js'

export const workouts = pgTable('workouts', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date().notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).notNull(),
  endTime: timestamp('end_time', { withTimezone: true }).notNull(),
  source: text().notNull(),
  sourceId: text('source_id'),
  type: text().notNull(),
  durationMin: real('duration_min').notNull(),
  calories: integer(),
  avgHr: integer('avg_hr'),
  maxHr: integer('max_hr'),
  zoneMinutesJsonb: jsonb('zone_minutes_jsonb').$type<ZoneMinutes>(),
  isPrimary: boolean('is_primary').notNull().default(false),
  duplicateOf: uuid('duplicate_of'),
  rawPayloadJsonb: jsonb('raw_payload_jsonb'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})
