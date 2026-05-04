import { createDb, type Database } from '@cico/db'

let _db: Database | null = null

export function db(connectionString: string): Database {
  if (!_db) _db = createDb(connectionString)
  return _db
}
