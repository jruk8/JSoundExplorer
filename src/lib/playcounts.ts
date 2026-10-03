// Anonymous play counts: batched upload + polled totals. No identifiers.

/** Flush pending plays every 5s when dirty: quick yet gentle. */
export const FLUSH_MS = 5000
/** Refresh displayed totals every 10s while the tab is visible. */
export const REFRESH_MS = 10000

// Absolute API origin for static hosting (GitHub Pages); empty = same-origin.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** Compact count: 999, 1.0K, 11K, 101K, 1.1M, 1.0B, failsafe to T. */
export function formatPlays(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0
  if (n < 1000) return String(n)
  const units: Array<[number, string]> = [
    [1e3, 'K'],
    [1e6, 'M'],
    [1e9, 'B'],
    [1e12, 'T'],
  ]
  let idx = 0
  while (idx < units.length - 1 && n >= units[idx][0] * 1000) idx++
  const div = units[idx][0]
  const suffix = units[idx][1]
  const q = n / div
  if (q >= 999.5 && idx < units.length - 1) {
    // Would round to 1000: show 1.0 of the next unit instead.
    const up = units[idx + 1]
    return `${(n / up[0]).toFixed(1)}${up[1]}`
  }
  if (q < 10) {
    // Floor to one decimal so 9999 shows 9.9K, never 10.0K.
    return `${(Math.floor(q * 10) / 10).toFixed(1)}${suffix}`
  }
  return `${Math.round(q)}${suffix}`
}

/** List sort: catalog order, or ranked by play counts (ties alphabetical). */
export type SortMode = 'none' | 'most' | 'least'

export function sortSoundKeys(
  keys: string[],
  counts: Record<string, number>,
  mode: SortMode,
): string[] {
  if (mode === 'none') return keys
  const ranked = [...keys]
  ranked.sort((a, b) => {
    const delta = (counts[a] ?? 0) - (counts[b] ?? 0)
    if (delta !== 0) return mode === 'most' ? -delta : delta
    return a < b ? -1 : a > b ? 1 : 0
  })
  return ranked
}

export async function fetchPlayCounts(): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE}/api/plays`)
  if (!res.ok) throw new Error(`plays fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('plays payload shape')
  }
  const raw = (data as { counts?: unknown }).counts
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('plays counts shape')
  }
  const counts: Record<string, number> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      counts[id] = Math.floor(value)
    }
  }
  return counts
}

export interface HourlyBucket {
  hour: string
  plays: number
}

export async function fetchHourlyPlays(): Promise<HourlyBucket[]> {
  const res = await fetch(`${API_BASE}/api/plays/hourly`)
  if (!res.ok) throw new Error(`hourly fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('hourly payload shape')
  }
  const raw = (data as { hours?: unknown }).hours
  if (!Array.isArray(raw)) throw new Error('hourly hours shape')
  const hours: HourlyBucket[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const { hour, plays } = entry as { hour?: unknown; plays?: unknown }
    if (typeof hour !== 'string') continue
    if (typeof plays !== 'number' || !Number.isFinite(plays) || plays < 0) continue
    hours.push({ hour, plays: Math.floor(plays) })
  }
  return hours
}

export interface DayBucket {
  day: string
  plays: number
}

export async function fetchDailyPlays(): Promise<DayBucket[]> {
  const res = await fetch(`${API_BASE}/api/plays/daily`)
  if (!res.ok) throw new Error(`daily fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('daily payload shape')
  }
  const raw = (data as { days?: unknown }).days
  if (!Array.isArray(raw)) throw new Error('daily days shape')
  const days: DayBucket[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const { day, plays } = entry as { day?: unknown; plays?: unknown }
    if (typeof day !== 'string') continue
    if (typeof plays !== 'number' || !Number.isFinite(plays) || plays < 0) continue
    days.push({ day, plays: Math.floor(plays) })
  }
  return days
}

export interface MonthBucket {
  month: string
  plays: number
}

export async function fetchMonthlyPlays(): Promise<MonthBucket[]> {
  const res = await fetch(`${API_BASE}/api/plays/monthly`)
  if (!res.ok) throw new Error(`monthly fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('monthly payload shape')
  }
  const raw = (data as { months?: unknown }).months
  if (!Array.isArray(raw)) throw new Error('monthly months shape')
  const months: MonthBucket[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue
    const { month, plays } = entry as { month?: unknown; plays?: unknown }
    if (typeof month !== 'string') continue
    if (typeof plays !== 'number' || !Number.isFinite(plays) || plays < 0) continue
    months.push({ month, plays: Math.floor(plays) })
  }
  return months
}

export async function postPlayCounts(plays: Record<string, number>): Promise<void> {
  const res = await fetch(`${API_BASE}/api/plays`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plays }),
  })
  if (!res.ok) throw new Error(`plays post failed: ${res.status}`)
}

export function beaconPlayCounts(plays: Record<string, number>): boolean {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return false
    }
    const blob = new Blob([JSON.stringify({ plays })], { type: 'application/json' })
    return navigator.sendBeacon(`${API_BASE}/api/plays`, blob)
  } catch {
    return false
  }
}
