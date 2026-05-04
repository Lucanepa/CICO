import { createDb } from '@cico/db'
import { loadFsvoFromFile } from '../apps/api/src/foods/fsvo.js'
import { upsertFoods } from '../apps/api/src/foods/store.js'

const path = process.argv[2]
if (!path) {
  console.error('usage: tsx scripts/import-fsvo.ts <path-to-fsvo.csv>')
  process.exit(1)
}
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL not set')

const foods = loadFsvoFromFile(path)
console.log(`parsed ${foods.length} foods`)

const db = createDb(url)
const n = await upsertFoods(db, foods)
console.log(`upserted ${n} foods`)
