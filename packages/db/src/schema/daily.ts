import { boolean, date, integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const dailyTotals = pgTable(
  'daily_totals',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    date: date().notNull(),
    source: text().notNull(),
    bmrCalories: integer('bmr_calories'),
    activeCalories: integer('active_calories'),
    totalCalories: integer('total_calories'),
    steps: integer(),
    restingHr: integer('resting_hr'),
    isPrimary: boolean('is_primary').notNull().default(false),
  },
  (t) => ({
    uniqUserDateSource: uniqueIndex('daily_totals_user_date_source_uniq').on(
      t.userId,
      t.date,
      t.source,
    ),
  }),
)
