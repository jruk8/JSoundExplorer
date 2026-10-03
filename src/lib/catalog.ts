// Sound catalog domain: types, catalog parsing, mock fallback data, and
// resource-server URLs. Pure data logic; no React dependency.

export interface SoundVariant {
  hash: string
  size: number
}

export type SoundCatalog = Record<string, SoundVariant[]>

export interface CatalogFile {
  version: string
  generatedAt: string
  sounds: SoundCatalog
}

export const RESOURCE_BASE = 'https://resources.download.minecraft.net'

export const CATALOG_URL = `${import.meta.env.BASE_URL}sounds.json`

/** Build a resource-server URL for a variant hash (<hh>/<hash>). */
export function buildResourceUrl(hash: string): string {
  return `${RESOURCE_BASE}/${hash.slice(0, 2)}/${hash}`
}

/** Pick a random variant from a list. */
export function pickVariant(variants: SoundVariant[]): SoundVariant {
  return variants[Math.floor(Math.random() * variants.length)]
}

function isVariantList(value: unknown): value is SoundVariant[] {
  if (!Array.isArray(value) || value.length === 0) return false
  return value.every(
    (v) =>
      typeof v === 'object' &&
      v !== null &&
      typeof (v as { hash?: unknown }).hash === 'string' &&
      typeof (v as { size?: unknown }).size === 'number',
  )
}

/**
 * Parse fetched sounds.json. Accepts both the wrapped
 * {version, generatedAt, sounds} shape and a bare key->variants map.
 */
export function parseCatalog(json: unknown): { sounds: SoundCatalog; version: string | null } {
  if (typeof json !== 'object' || json === null) throw new Error('Invalid catalog')
  const obj = json as Record<string, unknown>
  const maybeSounds = obj.sounds ?? json
  if (typeof maybeSounds !== 'object' || maybeSounds === null) throw new Error('Invalid catalog')
  const sounds: SoundCatalog = {}
  for (const [key, value] of Object.entries(maybeSounds as Record<string, unknown>)) {
    if (isVariantList(value)) sounds[key] = value
  }
  const version = typeof obj.version === 'string' ? obj.version : null
  return { sounds, version }
}

/** First dot-separated segment; the sidebar grouping key. */
export function namespaceOf(key: string): string {
  return key.split('.')[0]
}

// ---------------------------------------------------------------------------
// Offline mock fallback
// ---------------------------------------------------------------------------

export type MockWaveform = OscillatorType | 'noise'

export const MOCK_KEYS: string[] = [
  'mock.test.sine',
  'mock.test.square',
  'mock.test.sawtooth',
  'mock.test.triangle',
  'mock.test.noise',
]

export const MOCK_SOUNDS: SoundCatalog = Object.fromEntries(
  MOCK_KEYS.map((key) => [key, [{ hash: `mock-${key.split('.').pop()}`, size: 0 }]]),
) as SoundCatalog

const WAVEFORM_BY_SUFFIX: Record<string, MockWaveform> = {
  sine: 'sine',
  square: 'square',
  sawtooth: 'sawtooth',
  triangle: 'triangle',
  noise: 'noise',
}

export function mockWaveformForKey(key: string): MockWaveform {
  const suffix = key.split('.').pop() ?? ''
  return WAVEFORM_BY_SUFFIX[suffix] ?? 'sine'
}

/**
 * Swipe card title: keep the last two dot segments, split on dots and
 * underscores, and capitalize each word ("mob.wither_skeleton.hurt" ->
 * "Wither Skeleton Hurt"). Short keys degrade gracefully ("ui.click" ->
 * "Ui Click", "click" -> "Click").
 */
export function cardTitle(key: string): string {
  return key
    .split('.')
    .slice(-2)
    .join('.')
    .split(/[._]/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Compact base: strip a numeric sibling suffix (break4 -> break, hurt_2 -> hurt). */
export function baseKey(key: string): string {
  const stripped = key.replace(/([A-Za-z_])[0-9]+$/, '$1')
  // An underscore separator left dangling by the strip goes too.
  if (stripped !== key && stripped.endsWith('_')) return stripped.slice(0, -1)
  return stripped
}

/** Group raw keys by compact base; bare keys join digit siblings. */
export function compactKeys(keys: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>()
  for (const key of keys) {
    const base = baseKey(key)
    const group = groups.get(base)
    if (group) {
      group.push(key)
    } else {
      groups.set(base, [key])
    }
  }
  return groups
}

/** Random member of a compact group (the internal pick). */
export function pickMember(members: string[]): string {
  return members[Math.floor(Math.random() * members.length)]
}
