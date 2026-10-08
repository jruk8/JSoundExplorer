// Interaction mechanics: slider geometry, snap detents, timing constants,
// clipboard access, and surprise-scroll easing. UI-behavior helpers with
// no React dependency.

// Slider geometry (single source for input props and detent rendering).
export const PITCH_MIN = 0.1
export const PITCH_MAX = 2
export const PITCH_STEP = 0.1
export const VOLUME_MIN = 0
export const VOLUME_MAX = 100
export const VOLUME_STEP = 10
export const PITCH_DETENTS = 20 // (2 - 0.1) / 0.1 + 1
export const VOLUME_DETENTS = 11 // (100 - 0) / 10 + 1
export const PITCH_SNAP_PCT = (9 / 19) * 100 // pitch 1.0 is detent index 9 of 20
export const VOLUME_SNAP_PCT = 100 // volume 100 is the last detent

// Magnetic snap detents: pitch sticks to 1.0x, volume to 100% (= 1.0 gain)
// when the slider lands within a small radius of the point.
export const PITCH_SNAP_TARGET = 1
export const PITCH_SNAP_RADIUS = 0.06
export const VOLUME_SNAP_TARGET = 100
export const VOLUME_SNAP_RADIUS = 6

/** Snap near-miss values onto a detent point, else return the value unchanged. */
export function snapValue(value: number, target: number, radius: number): number {
  return Math.abs(value - target) < radius ? target : value
}

// Copy-on-double-click timing.
export const DOUBLE_CLICK_MS = 500
export const COPIED_VISIBLE_MS = 1100
export const COPIED_BLUE_MS = 400

/** Pitch pool for the "also pitch" surprise option: strictly 0.1 steps. */
export const SURPRISE_PITCHES = [0.8, 0.9, 1.0, 1.1, 1.2]

/** Cubic ease-out for the surprise scroll animation. */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

/** Quartic ease-in for UI fade-outs: holds loud, then dives to silence. */
export function easeInQuart(t: number): number {
  return t * t * t * t
}

const VAULT_FALLBACK = '#1a1d24' // --bg #1e2129 darkened 13%.

/**
 * Darken a #rgb/#rrggbb/rgb() color by factor (0-1), returning #rrggbb.
 * Unparseable input falls back to the darkened default background.
 */
export function darkenColor(color: string, factor: number): string {
  const c = color.trim().toLowerCase()
  let r = -1
  let g = 0
  let b = 0
  if (c.startsWith('#')) {
    const hex = c.slice(1)
    if (/^[0-9a-f]{3}$/.test(hex)) {
      r = parseInt(hex[0] + hex[0], 16)
      g = parseInt(hex[1] + hex[1], 16)
      b = parseInt(hex[2] + hex[2], 16)
    } else if (/^[0-9a-f]{6}$/.test(hex)) {
      r = parseInt(hex.slice(0, 2), 16)
      g = parseInt(hex.slice(2, 4), 16)
      b = parseInt(hex.slice(4, 6), 16)
    }
  } else {
    const m = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
    if (m) {
      r = Number(m[1])
      g = Number(m[2])
      b = Number(m[3])
    }
  }
  if (r < 0 || r > 255 || g < 0 || g > 255 || b < 0 || b > 255) return VAULT_FALLBACK
  const mix = (v: number) =>
    Math.round(v * Math.min(1, Math.max(0, factor)))
      .toString(16)
      .padStart(2, '0')
  return `#${mix(r)}${mix(g)}${mix(b)}`
}

// Vault intro tuning. Preferred fanfare stings are /playsound event ids.
export const VAULT_SOUNDS = [
  'entity.item.pickup',
  'entity.experience_orb.pickup',
  'block.lever.click',
  'block.glass.break',
  'entity.player.levelup',
]
export const VAULT_PITCHES = [0.9, 1, 1.1]
export const VAULT_OPEN_PX = 240
export const VAULT_COMMIT_FRACTION = 0.5
export const VAULT_FLING_PX_PER_MS = 0.8
export const VAULT_CLICK_PX = 6

/** Cubic resistance: barely budges at first, then breaks open. */
export function vaultSeparation(distPx: number, clearPx: number): number {
  const n = Math.min(1, Math.max(0, distPx / VAULT_OPEN_PX))
  return n * n * n * clearPx
}

/** Click, committed drag, or fling all open the vault. */
export function vaultShouldOpen(distPx: number, velPxPerMs: number): boolean {
  if (distPx < VAULT_CLICK_PX) return true
  const n = Math.min(1, distPx / VAULT_OPEN_PX)
  return n >= VAULT_COMMIT_FRACTION || Math.abs(velPxPerMs) > VAULT_FLING_PX_PER_MS
}

/** Vault fanfare: prefer the named sounds, else any catalog key, else null. */
export function pickVaultSound(pool: string[], random: () => number = Math.random): string | null {
  const matches = VAULT_SOUNDS.filter((s) => pool.includes(s))
  const from = matches.length > 0 ? matches : pool
  if (from.length === 0) return null
  return from[Math.floor(random() * from.length)]
}

export function pickVaultPitch(random: () => number = Math.random): number {
  return VAULT_PITCHES[Math.floor(random() * VAULT_PITCHES.length)]
}

/** Surprise/spotlight sequencing: ease-out scroll, then the auto-click delay. */
export const SURPRISE_SCROLL_MS = 450
export const SURPRISE_CLICK_DELAY_MS = 60

/** UI sound: the preferred key when cataloged, else the vault fanfare pool. */
export function pickUiSound(
  pool: string[],
  preferred: string,
  random: () => number = Math.random,
): string | null {
  if (pool.includes(preferred)) return preferred
  return pickVaultSound(pool, random)
}

export async function copyText(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for non-secure contexts.
  const area = document.createElement('textarea')
  area.value = text
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  document.body.removeChild(area)
}

// Swipe game tuning.
export type SwipeDirection = 'left' | 'right'
export const SWIPE_OVERLAY_MS = 450
export const SWIPE_REVEAL_MS = 450
export const SWIPE_COMMIT_PX = 100
/** Discard sting, played strictly (no fallback when uncataloged). */
export const SWIPE_DISCARD_SOUND = 'block.snow.step'
/** Non-card swipe sounds play at half the configured volume. */
export const SWIPE_UI_VOLUME_FACTOR = 0.5

// Classical performance tuning: one lookahead tick fires due notes and
// releases expired ones, so a piece needs no per-note timers at all.
export const CLASSICAL_TICK_MS = 50
/** Note-off release tail: a short fade instead of a hard cut. */
export const CLASSICAL_RELEASE_MS = 100
/** Safety tail: a stuck performance ends this far past the last note. */
export const CLASSICAL_END_TAIL_MS = 8000
/** Unmatched note-ons ring this long (also cut by stop/retrigger). */
export const CLASSICAL_OPEN_NOTE_MS = 2000

/** Ease-out-back for card bounce-back (slight overshoot past center). */
export function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
