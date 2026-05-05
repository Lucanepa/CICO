import { and, between, eq } from 'drizzle-orm'
import type { Database } from '@cico/db'
import { schema } from '@cico/db'

export type HrSample = { timestamp: Date; bpm: number }

export async function replaceHrSamplesForWindow(
  db: Database,
  userId: string,
  source: string,
  start: Date,
  end: Date,
  samples: HrSample[],
): Promise<number> {
  if (samples.length === 0) return 0

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.heartRateSamples)
      .where(
        and(
          eq(schema.heartRateSamples.userId, userId),
          eq(schema.heartRateSamples.source, source),
          between(schema.heartRateSamples.timestamp, start, end),
        ),
      )

    const chunkSize = 1000
    for (let i = 0; i < samples.length; i += chunkSize) {
      const chunk = samples.slice(i, i + chunkSize)
      await tx.insert(schema.heartRateSamples).values(
        chunk.map((s) => ({
          userId,
          timestamp: s.timestamp,
          bpm: s.bpm,
          source,
        })),
      )
    }
  })

  return samples.length
}
