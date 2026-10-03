import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayHistoryEntry } from './preferences.ts'
import {
  HISTORY_LIMIT,
  HISTORY_STORAGE_KEY,
  SORT_MODE_KEY,
  insertHistoryEntry,
  loadPlayHistory,
  loadSortMode,
  savePlayHistory,
  saveSortMode,
} from './preferences.ts'

const entry = (key: string, pitch = 1, volume = 100): PlayHistoryEntry => ({ key, pitch, volume })

describe('insertHistoryEntry', () => {
  it('prepends new entries', () => {
    expect(insertHistoryEntry([entry('a')], entry('b'))).toEqual([entry('b'), entry('a')])
  })

  it('bumps a replayed sound to the top without duplicating', () => {
    const entries = [entry('a'), entry('b'), entry('c')]
    expect(insertHistoryEntry(entries, entry('c'))).toEqual([
      entry('c'),
      entry('a'),
      entry('b'),
    ])
  })

  it('bumps by key even when the mix changed', () => {
    const entries = [entry('a'), entry('b', 1, 100)]
    expect(insertHistoryEntry(entries, entry('b', 1.2, 50))).toEqual([
      entry('b', 1.2, 50),
      entry('a'),
    ])
  })

  it('caps the list at the history limit', () => {
    const entries = Array.from({ length: HISTORY_LIMIT }, (_, i) => entry(`k${i}`))
    const next = insertHistoryEntry(entries, entry('new'))
    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0]).toEqual(entry('new'))
    expect(next[HISTORY_LIMIT - 1]).toEqual(entry(`k${HISTORY_LIMIT - 2}`))
  })
})

describe('play history storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    })
  })

  it('round-trips entries', () => {
    const entries = [entry('b', 1.2, 50), entry('a')]
    savePlayHistory(entries)
    expect(JSON.parse(store.get(HISTORY_STORAGE_KEY) as string)).toEqual(entries)
    expect(loadPlayHistory()).toEqual(entries)
  })

  it('returns empty for corrupt or non-array payloads', () => {
    store.set(HISTORY_STORAGE_KEY, '{nope')
    expect(loadPlayHistory()).toEqual([])
    store.set(HISTORY_STORAGE_KEY, '{"a":1}')
    expect(loadPlayHistory()).toEqual([])
  })

  it('filters invalid entries', () => {
    store.set(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        entry('a', 1.2, 50),
        { key: 'b', pitch: 'x', volume: 50 },
        { key: 'c', pitch: 1 },
        null,
      ]),
    )
    expect(loadPlayHistory()).toEqual([entry('a', 1.2, 50)])
  })
})

describe('sort mode storage', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    })
  })

  it('defaults to most played', () => {
    expect(loadSortMode()).toBe('most')
  })

  it('round-trips the mode', () => {
    saveSortMode('least')
    expect(store.get(SORT_MODE_KEY)).toBe('least')
    expect(loadSortMode()).toBe('least')
  })

  it('falls back to most played on unknown values', () => {
    store.set(SORT_MODE_KEY, 'bogus')
    expect(loadSortMode()).toBe('most')
  })
})
