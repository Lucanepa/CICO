import type { Database } from '@cico/db'
import { schema } from '@cico/db'
import { getLastSync, markSyncError, markSyncSuccess } from '../../lib/sync-state.js'
import { aggregateHuaweiDaily, parseHealthSyncCsv, type HuaweiDailyAggregate } from './csv.js'
import {
  downloadFile,
  GoogleNotConnectedError,
  listFolderFiles,
  type GoogleOpts,
} from './drive.js'

export type HealthSyncResult = {
  filesProcessed: number
  daysWritten: number
}

export async function syncHealthSync(
  db: Database,
  opts: GoogleOpts,
  userId: string,
  folderId: string,
  windowStart?: Date,
): Promise<HealthSyncResult> {
  try {
    const after = windowStart ?? (await getLastSync(db, 'huawei')) ?? undefined

    let filesProcessed = 0
    const aggregates: HuaweiDailyAggregate[] = []

    for await (const file of listFolderFiles(db, opts, folderId, after)) {
      const text = await downloadFile(db, opts, file.id)
      const rows = parseHealthSyncCsv(text)
      if (rows.length === 0) continue
      aggregates.push(...aggregateHuaweiDaily(rows))
      filesProcessed++
    }

    const merged = mergeAggregates(aggregates)
    let daysWritten = 0
    for (const a of merged) {
      const totalCalories = a.totalCalories ?? null
      const activeCalories = a.activeCalories ?? null
      const bmrCalories =
        totalCalories != null && activeCalories != null ? totalCalories - activeCalories : null

      await db
        .insert(schema.dailyTotals)
        .values({
          userId,
          date: a.date,
          source: 'huawei',
          bmrCalories,
          activeCalories,
          totalCalories,
          steps: a.steps ?? null,
          restingHr: a.restingHr ?? null,
        })
        .onConflictDoUpdate({
          target: [schema.dailyTotals.userId, schema.dailyTotals.date, schema.dailyTotals.source],
          set: {
            bmrCalories,
            activeCalories,
            totalCalories,
            steps: a.steps ?? null,
            restingHr: a.restingHr ?? null,
          },
        })
      daysWritten++
    }

    await markSyncSuccess(db, 'huawei')
    return { filesProcessed, daysWritten }
  } catch (err) {
    await markSyncError(db, 'huawei', err)
    throw err
  }
}

export { GoogleNotConnectedError }

function mergeAggregates(items: HuaweiDailyAggregate[]): HuaweiDailyAggregate[] {
  const byDate = new Map<string, HuaweiDailyAggregate>()
  for (const a of items) {
    const existing = byDate.get(a.date)
    if (!existing) {
      byDate.set(a.date, { ...a })
      continue
    }
    existing.totalCalories = preferLarger(existing.totalCalories, a.totalCalories)
    existing.activeCalories = preferLarger(existing.activeCalories, a.activeCalories)
    existing.steps = preferLarger(existing.steps, a.steps)
    existing.restingHr = a.restingHr ?? existing.restingHr
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

function preferLarger(a: number | undefined, b: number | undefined): number | undefined {
  if (a == null) return b
  if (b == null) return a
  return Math.max(a, b)
}
