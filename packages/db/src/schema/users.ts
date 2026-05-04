import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  settingsJsonb: jsonb('settings_jsonb').$type<UserSettings>().notNull().default({}),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
})

export type UserSettings = {
  birthYear?: number
  maxHrOverride?: number
  timezone?: string
  weightKg?: number
}
