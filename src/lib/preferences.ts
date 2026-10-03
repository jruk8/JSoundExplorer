// Persisted user state (namespace toggles, play history, list sort).
// localStorage only; no React dependency.
import type { SortMode } from './playcounts.ts'

export const NAMESPACE_PREFS_KEY = 'jsoundexplorer.namespaceToggles.v1'
export const SORT_MODE_KEY = 'jsoundexplorer.sortMode.v1'
export const DEFAULT_SORT_MODE: SortMode = 'most'

/** Namespaces that start disabled. The list itself stays dynamic (derived */
/** from the catalog); only this default-off rule is hardcoded. */
export const DEFAULT_OFF_NAMESPACES: ReadonlySet<string> = new Set(['ambient'])

export function loadNamespacePrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAMESPACE_PREFS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const prefs: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') prefs[key] = value
    }
    return prefs
  } catch {
    return {}
  }
}

export function saveNamespacePrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(NAMESPACE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable (private mode etc.): run unpersisted.
  }
}

export function loadSortMode(): SortMode {
  try {
    const raw = localStorage.getItem(SORT_MODE_KEY)
    if (raw === 'none' || raw === 'most' || raw === 'least') return raw
    return DEFAULT_SORT_MODE
  } catch {
    return DEFAULT_SORT_MODE
  }
}

export function saveSortMode(mode: SortMode): void {
  try {
    localStorage.setItem(SORT_MODE_KEY, mode)
  } catch {
    // Storage unavailable (private mode etc.): run unpersisted.
  }
}

export const HISTORY_STORAGE_KEY = 'jsoundexplorer.history.v1'
export const HISTORY_LIMIT = 50

export interface PlayHistoryEntry {
  key: string
  pitch: number
  volume: number
}

function isHistoryEntry(value: unknown): value is PlayHistoryEntry {
  if (typeof value !== 'object' || value === null) return false
  const e = value as Record<string, unknown>
  return (
    typeof e.key === 'string' &&
    typeof e.pitch === 'number' &&
    Number.isFinite(e.pitch) &&
    typeof e.volume === 'number' &&
    Number.isFinite(e.volume)
  )
}

/** Prepend an entry, dropping any older entry for the same key (replay bump). */
export function insertHistoryEntry(
  entries: PlayHistoryEntry[],
  entry: PlayHistoryEntry,
): PlayHistoryEntry[] {
  return [entry, ...entries.filter((e) => e.key !== entry.key)].slice(0, HISTORY_LIMIT)
}

export function loadPlayHistory(): PlayHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function savePlayHistory(entries: PlayHistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)))
  } catch {
    // Storage unavailable (private mode etc.): run unpersisted.
  }
}
