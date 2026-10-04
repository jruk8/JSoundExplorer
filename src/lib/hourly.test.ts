import { describe, expect, it } from 'vitest'
import {
  formatDayLabel,
  formatHourLabel,
  formatMonthLabel,
  normalizeDaily,
  normalizeHourly,
  normalizeMonthly,
} from './hourly.ts'

describe('normalizeHourly', () => {
  it('anchors on the latest server bucket and zero-fills', () => {
    const points = normalizeHourly(
      [
        { hour: '2026-10-03T18:00:00Z', plays: 12 },
        { hour: '2026-10-03T20:00:00Z', plays: 5 },
      ],
      Date.parse('2026-10-03T20:37:00Z'),
    )
    expect(points).toHaveLength(8)
    expect(points[7].date.toISOString()).toBe('2026-10-03T20:00:00.000Z')
    expect(points[7].plays).toBe(5)
    expect(points[5].date.toISOString()).toBe('2026-10-03T18:00:00.000Z')
    expect(points[5].plays).toBe(12)
    expect(points[6].plays).toBe(0)
    expect(points[0].date.toISOString()).toBe('2026-10-03T13:00:00.000Z')
  })

  it('anchors on the current hour with no data', () => {
    const now = Date.parse('2026-10-03T20:37:00Z')
    const points = normalizeHourly([], now)
    expect(points).toHaveLength(8)
    expect(points[7].date.toISOString()).toBe('2026-10-03T20:00:00.000Z')
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('drops malformed buckets', () => {
    const points = normalizeHourly(
      [{ hour: 'not-a-date', plays: 99 }],
      Date.parse('2026-10-03T20:00:00Z'),
    )
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('keeps the server bucket when the server clock runs ahead', () => {
    const points = normalizeHourly(
      [{ hour: '2026-10-03T22:00:00Z', plays: 9 }],
      Date.parse('2026-10-03T20:37:00Z'),
    )
    expect(points[7].date.toISOString()).toBe('2026-10-03T22:00:00.000Z')
    expect(points[7].plays).toBe(9)
  })

  it('advances to the current hour when the latest bucket is stale', () => {
    const points = normalizeHourly(
      [{ hour: '2026-10-03T18:00:00Z', plays: 12 }],
      Date.parse('2026-10-03T20:37:00Z'),
    )
    expect(points).toHaveLength(8)
    expect(points[7].date.toISOString()).toBe('2026-10-03T20:00:00.000Z')
    expect(points[7].plays).toBe(0)
    expect(points[5].date.toISOString()).toBe('2026-10-03T18:00:00.000Z')
    expect(points[5].plays).toBe(12)
  })
})

describe('normalizeDaily', () => {
  it('anchors on the latest server bucket and zero-fills', () => {
    const points = normalizeDaily(
      [
        { day: '2026-10-01T00:00:00Z', plays: 3 },
        { day: '2026-10-03T00:00:00Z', plays: 7 },
      ],
      Date.parse('2026-10-03T20:37:00Z'),
    )
    expect(points).toHaveLength(7)
    expect(points[6].date.toISOString()).toBe('2026-10-03T00:00:00.000Z')
    expect(points[6].plays).toBe(7)
    expect(points[4].date.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(points[4].plays).toBe(3)
    expect(points[5].plays).toBe(0)
    expect(points[0].date.toISOString()).toBe('2026-09-27T00:00:00.000Z')
  })

  it('anchors on the current day with no data', () => {
    const now = Date.parse('2026-10-03T20:37:00Z')
    const points = normalizeDaily([], now)
    expect(points).toHaveLength(7)
    expect(points[6].date.toISOString()).toBe('2026-10-03T00:00:00.000Z')
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('drops malformed buckets', () => {
    const points = normalizeDaily(
      [{ day: 'not-a-date', plays: 99 }],
      Date.parse('2026-10-03T20:00:00Z'),
    )
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('advances to the current day when the latest bucket is stale', () => {
    const points = normalizeDaily(
      [{ day: '2026-10-01T00:00:00Z', plays: 3 }],
      Date.parse('2026-10-03T20:37:00Z'),
    )
    expect(points).toHaveLength(7)
    expect(points[6].date.toISOString()).toBe('2026-10-03T00:00:00.000Z')
    expect(points[6].plays).toBe(0)
    expect(points[4].date.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(points[4].plays).toBe(3)
  })
})

describe('normalizeMonthly', () => {
  it('anchors on the latest server bucket and zero-fills', () => {
    const points = normalizeMonthly(
      [
        { month: '2026-01-01T00:00:00Z', plays: 4 },
        { month: '2026-03-01T00:00:00Z', plays: 9 },
      ],
      Date.parse('2026-03-15T12:00:00Z'),
    )
    expect(points).toHaveLength(12)
    expect(points[11].date.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(points[11].plays).toBe(9)
    expect(points[9].date.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(points[9].plays).toBe(4)
    expect(points[10].plays).toBe(0)
    expect(points[0].date.toISOString()).toBe('2025-04-01T00:00:00.000Z')
  })

  it('anchors on the current month with no data', () => {
    const now = Date.parse('2026-10-03T20:37:00Z')
    const points = normalizeMonthly([], now)
    expect(points).toHaveLength(12)
    expect(points[11].date.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('drops malformed buckets', () => {
    const points = normalizeMonthly(
      [{ month: 'not-a-date', plays: 99 }],
      Date.parse('2026-10-03T20:00:00Z'),
    )
    expect(points.every((p) => p.plays === 0)).toBe(true)
  })

  it('advances to the current month when the latest bucket is stale', () => {
    const points = normalizeMonthly(
      [{ month: '2026-01-01T00:00:00Z', plays: 4 }],
      Date.parse('2026-03-15T12:00:00Z'),
    )
    expect(points).toHaveLength(12)
    expect(points[11].date.toISOString()).toBe('2026-03-01T00:00:00.000Z')
    expect(points[11].plays).toBe(0)
    expect(points[9].date.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(points[9].plays).toBe(4)
  })
})

describe('formatHourLabel', () => {
  it('labels 12h locales like 8PM', () => {
    expect(formatHourLabel(new Date(2026, 9, 3, 20, 0, 0), 'h12')).toBe('8PM')
    expect(formatHourLabel(new Date(2026, 9, 3, 0, 0, 0), 'h12')).toBe('12AM')
    expect(formatHourLabel(new Date(2026, 9, 3, 12, 0, 0), 'h12')).toBe('12PM')
    expect(formatHourLabel(new Date(2026, 9, 3, 8, 0, 0), 'h12')).toBe('8AM')
  })

  it('labels 24h locales like 20:00', () => {
    expect(formatHourLabel(new Date(2026, 9, 3, 20, 0, 0), 'h23')).toBe('20:00')
    expect(formatHourLabel(new Date(2026, 9, 3, 8, 0, 0), 'h23')).toBe('08:00')
  })
})

describe('formatDayLabel', () => {
  it('shows the locale day and month numbers', () => {
    const label = formatDayLabel(new Date(2026, 9, 4))
    const nums = (label.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b)
    expect(nums).toEqual([4, 10])
  })
})

describe('formatMonthLabel', () => {
  it('names 12 consecutive months distinctly', () => {
    const labels = Array.from({ length: 12 }, (_, i) => formatMonthLabel(new Date(2026, i, 1)))
    expect(new Set(labels).size).toBe(12)
    for (const label of labels) expect(label.length).toBeGreaterThan(0)
  })
})
