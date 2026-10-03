// Play-total trends: hourly/daily/monthly series from the API, labeled
// in the user's timezone. Pure time logic; no React dependency.
import { en } from '../locales/en.ts'

/** One UTC hour bucket from GET /api/plays/hourly. */
export interface HourBucket {
  hour: string
  plays: number
}

export interface HourPoint {
  date: Date
  plays: number
}

/** One UTC day bucket from GET /api/plays/daily. */
export interface DayBucket {
  day: string
  plays: number
}

export interface DayPoint {
  date: Date
  plays: number
}

/** One UTC month bucket from GET /api/plays/monthly. */
export interface MonthBucket {
  month: string
  plays: number
}

export interface MonthPoint {
  date: Date
  plays: number
}

/** Chart window: the last 8 hours, capped. */
export const HOURLY_WINDOW = 8
/** Chart window: the last 7 days, capped. */
export const DAILY_WINDOW = 7
/** Chart window: the last 12 months, capped. */
export const MONTHLY_WINDOW = 12

const HOUR_MS = 3600_000
const DAY_MS = 86_400_000

/** Validate + floor sparse buckets into a play-count map keyed by ms. */
function indexBuckets(
  buckets: Array<{ at: string; plays: number }>,
  floor: (t: number) => number,
): Map<number, number> {
  const byTime = new Map<number, number>()
  for (const b of buckets) {
    const t = Date.parse(b.at)
    if (!Number.isFinite(t)) continue
    const plays = Number.isFinite(b.plays) ? Math.max(0, Math.floor(b.plays)) : 0
    byTime.set(floor(t), plays)
  }
  return byTime
}

/** Latest bucket, or the fallback anchor when there is no data yet. */
function latestOrNow(times: number[], fallback: number): number {
  const sorted = [...times].sort((a, b) => a - b)
  return sorted.length > 0 ? sorted[sorted.length - 1] : fallback
}

/**
 * Normalize sparse server buckets into exactly 8 contiguous hourly points,
 * zero-filled. Anchors on the latest server bucket (clock-skew safe);
 * with no data yet, anchors on the current UTC hour.
 */
export function normalizeHourly(hours: HourBucket[], nowMs: number = Date.now()): HourPoint[] {
  const byHour = indexBuckets(
    hours.map((h) => ({ at: h.hour, plays: h.plays })),
    (t) => Math.floor(t / HOUR_MS) * HOUR_MS,
  )
  const anchor = latestOrNow([...byHour.keys()], Math.floor(nowMs / HOUR_MS) * HOUR_MS)
  return Array.from({ length: HOURLY_WINDOW }, (_, i) => {
    const t = anchor - (HOURLY_WINDOW - 1 - i) * HOUR_MS
    return { date: new Date(t), plays: byHour.get(t) ?? 0 }
  })
}

/**
 * Normalize sparse server buckets into exactly 7 contiguous daily points,
 * zero-filled. Anchors on the latest server bucket (clock-skew safe);
 * with no data yet, anchors on the current UTC day.
 */
export function normalizeDaily(days: DayBucket[], nowMs: number = Date.now()): DayPoint[] {
  const byDay = indexBuckets(
    days.map((d) => ({ at: d.day, plays: d.plays })),
    (t) => Math.floor(t / DAY_MS) * DAY_MS,
  )
  const anchor = latestOrNow([...byDay.keys()], Math.floor(nowMs / DAY_MS) * DAY_MS)
  return Array.from({ length: DAILY_WINDOW }, (_, i) => {
    const t = anchor - (DAILY_WINDOW - 1 - i) * DAY_MS
    return { date: new Date(t), plays: byDay.get(t) ?? 0 }
  })
}

function floorMonthUtc(t: number): number {
  const d = new Date(t)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
}

/**
 * Normalize sparse server buckets into exactly 12 contiguous monthly
 * points, zero-filled. Anchors on the latest server bucket (clock-skew
 * safe); with no data yet, anchors on the current UTC month.
 */
export function normalizeMonthly(
  months: MonthBucket[],
  nowMs: number = Date.now(),
): MonthPoint[] {
  const byMonth = indexBuckets(
    months.map((m) => ({ at: m.month, plays: m.plays })),
    floorMonthUtc,
  )
  const anchor = latestOrNow([...byMonth.keys()], floorMonthUtc(nowMs))
  return Array.from({ length: MONTHLY_WINDOW }, (_, i) => {
    const d = new Date(anchor)
    const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (MONTHLY_WINDOW - 1 - i), 1)
    return { date: new Date(t), plays: byMonth.get(t) ?? 0 }
  })
}

export type HourCycle = 'h12' | 'h23'

/** Detect whether the user's locale uses 12h or 24h time. */
export function detectHourCycle(): HourCycle {
  try {
    // hourCycle postdates this TS lib; read it loosely (present at runtime).
    const resolved = new Intl.DateTimeFormat(undefined, { hour: 'numeric' })
      .resolvedOptions() as { hourCycle?: string }
    const hc = resolved.hourCycle
    return hc === 'h11' || hc === 'h12' ? 'h12' : 'h23'
  } catch {
    return 'h23'
  }
}

/**
 * Compact hour label in the user's timezone: "8PM" for 12h locales,
 * "20:00" for 24h locales.
 */
export function formatHourLabel(date: Date, cycle: HourCycle): string {
  const h = date.getHours()
  if (cycle === 'h12') {
    return `${h % 12 || 12}${h < 12 ? en.time.am : en.time.pm}`
  }
  return `${String(h).padStart(2, '0')}:00`
}

/** Compact day label in the user's locale: "10/4", "4.10.", etc. */
export function formatDayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'numeric' })
}

/** Compact month label in the user's locale: "Oct", "okt.", etc. */
export function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short' })
}
