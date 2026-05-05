import { date, integer, jsonb, pgTable, real, text, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const bodyMeasurements = pgTable(
  'body_measurements',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date().notNull(),
    measuredAt: timestamp('measured_at', { withTimezone: true }),
    time: time(),
    source: text().notNull(),
    sourceId: text('source_id'),

    weightKg: real('weight_kg'),
    fatPct: real('fat_pct'),
    leanMassKg: real('lean_mass_kg'),
    muscleMassKg: real('muscle_mass_kg'),
    skeletalMusclePct: real('skeletal_muscle_pct'),
    boneMassKg: real('bone_mass_kg'),
    waterPct: real('water_pct'),
    visceralFat: real('visceral_fat'),
    bmrKcal: integer('bmr_kcal'),
    bodyAge: integer('body_age'),
    bmi: real(),

    heartRate: integer('heart_rate'),
    pwv: real(),

    rawPayloadJsonb: jsonb('raw_payload_jsonb'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserSourceSourceId: uniqueIndex('body_measurements_user_source_sourceid_uniq').on(
      t.userId,
      t.source,
      t.sourceId,
    ),
  }),
)
