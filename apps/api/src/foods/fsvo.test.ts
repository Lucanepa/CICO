import { describe, expect, it } from 'vitest'
import { parseFsvoCsv } from './fsvo.js'

describe('parseFsvoCsv', () => {
  it('parses a semicolon-delimited German FSVO export', () => {
    const csv = [
      'ID;Name DE;Energie kcal;Protein;Kohlenhydrate;Fett;Nahrungsfasern',
      '1;Apfel roh;52;0,3;14,1;0,2;2,4',
      '2;"Rindfleisch, mager";143;22,0;0,0;5,9;-',
    ].join('\n')
    const foods = parseFsvoCsv(csv)
    expect(foods).toHaveLength(2)
    expect(foods[0]).toMatchObject({
      source: 'fsvo',
      sourceId: '1',
      name: 'Apfel roh',
      kcal100g: 52,
      p100g: 0.3,
      c100g: 14.1,
      f100g: 0.2,
      fiber100g: 2.4,
    })
    expect(foods[1]?.name).toBe('Rindfleisch, mager')
    expect(foods[1]?.fiber100g).toBeNull()
  })

  it('falls back to row index when no id column is present', () => {
    const csv = ['Name;Energie kcal;Protein;Kohlenhydrate;Fett', 'Banane;89;1,1;22,8;0,3'].join('\n')
    const foods = parseFsvoCsv(csv)
    expect(foods[0]?.sourceId).toBe('0')
  })

  it('returns empty when header is missing required columns', () => {
    const csv = ['Name;Energie\nApfel;52'].join('\n')
    expect(parseFsvoCsv(csv)).toHaveLength(0)
  })
})
