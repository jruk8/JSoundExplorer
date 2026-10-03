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
