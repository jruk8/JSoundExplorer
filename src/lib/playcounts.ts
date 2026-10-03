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
