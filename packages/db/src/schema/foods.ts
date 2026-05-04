import { date, integer, jsonb, pgTable, real, text, time, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const foods = pgTable('foods', {
  id: uuid().primaryKey().defaultRandom(),
  source: text().notNull(),
  sourceId: text().notNull(),
  name: text().notNull(),
  kcal100g: real('kcal_100g').notNull(),
  p100g: real('p_100g'),
  c100g: real('c_100g'),
  f100g: real('f_100g'),
  fiber100g: real('fiber_100g'),
  microsJsonb: jsonb('micros_jsonb'),
  defaultServingG: real('default_serving_g'),
  barcode: text(),
})

export const customFoods = pgTable('custom_foods', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  kcal100g: real('kcal_100g').notNull(),
  p100g: real('p_100g'),
  c100g: real('c_100g'),
  f100g: real('f_100g'),
  fiber100g: real('fiber_100g'),
  microsJsonb: jsonb('micros_jsonb'),
  defaultServingG: real('default_serving_g'),
})

export const foodLog = pgTable('food_log', {
  id: uuid().primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  date: date().notNull(),
  time: time(),
  foodId: uuid('food_id'),
  foodTable: text('food_table').notNull(),
  quantityG: real('quantity_g').notNull(),
  kcal: integer().notNull(),
  p: real(),
  c: real(),
  f: real(),
  sourceLabel: text('source_label'),
})
