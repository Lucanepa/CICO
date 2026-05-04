import { describe, expect, it } from 'vitest'
import { aggregateHuaweiDaily, parseHealthSyncCsv } from './csv.js'

describe('parseHealthSyncCsv', () => {
  it('parses a typical Health Sync export', () => {
    const csv = [
      '"Type","Date","Time","Value","Unit","Source","Notes"',
      '"Total calories burned","2026-04-29","12:00","1500","kcal","Huawei Health",""',
      '"Active calories burned","2026-04-29","12:00","400","kcal","Huawei Health",""',
      '"Steps","2026-04-29","12:00","8000","count","Huawei Health",""',
    ].join('\n')

    const rows = parseHealthSyncCsv(csv)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({
      type: 'Total calories burned',
      date: '2026-04-29',
      value: 1500,
      source: 'Huawei Health',
    })
  })

  it('aggregates daily totals from huawei rows and ignores other sources', () => {
    const csv = [
      '"Type","Date","Time","Value","Unit","Source","Notes"',
      '"Total calories burned","2026-04-29","12:00","1500","kcal","Huawei Health",""',
      '"Total calories burned","2026-04-29","18:00","700","kcal","Huawei Health",""',
      '"Active calories burned","2026-04-29","12:00","400","kcal","Huawei Health",""',
      '"Steps","2026-04-29","12:00","8000","count","Huawei Health",""',
      '"Resting heart rate","2026-04-29","08:00","58","bpm","Huawei Health",""',
      '"Steps","2026-04-29","12:00","9999","count","Apple Health",""',
    ].join('\n')

    const agg = aggregateHuaweiDaily(parseHealthSyncCsv(csv))
    expect(agg).toHaveLength(1)
    expect(agg[0]).toMatchObject({
      date: '2026-04-29',
      totalCalories: 2200,
      activeCalories: 400,
      steps: 8000,
      restingHr: 58,
    })
  })

  it('handles dd.mm.yyyy date format', () => {
    const csv = [
      '"Type","Date","Time","Value","Unit","Source","Notes"',
      '"Total calories burned","29.04.2026","12:00","1800","kcal","Huawei Health",""',
    ].join('\n')

    const agg = aggregateHuaweiDaily(parseHealthSyncCsv(csv))
    expect(agg[0]?.date).toBe('2026-04-29')
  })
})
