// Sample pitch detection: find the musical note a sample's base pitch
// most corresponds to, so MIDI notes anchor to real pitch instead of
// assuming middle C. Anything uncertain (noise, silence, drift)
// yields null and callers keep the middle-C assumption.

// Absolute API origin for static hosting (GitHub Pages); empty = same-origin.
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

/** Byte-proxy for a Mojang sample (the CDN sends no CORS headers). */
export function sampleProxyUrl(hash: string): string {
  return `${API_BASE}/api/sample?hash=${encodeURIComponent(hash)}`
}

/** Nearest MIDI note for a frequency (A4 = 440Hz = 69). */
export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440)
}

/** Detection range: below is rumble, above is hiss for anchors. */
export const PITCH_MIN_HZ = 40
export const PITCH_MAX_HZ = 2000
const WINDOW_SAMPLES = 4096
const MIN_SAMPLES = 2048
/** Windows kept below this correlation are too noisy to trust. */
const MIN_WINDOW_CONFIDENCE = 0.5
/** A window counts when its best peak is this self-consistent. */
const PEAK_MARGIN = 0.85
/** The kept windows must agree within this many semitones. */
const WINDOW_AGREE_SEMITONES = 2
const ANALYSIS_WINDOWS = 5
/** RMS below this is silence, not pitch. */
const SILENCE_RMS = 0.01

/**
 * Autocorrelation fundamental of one window. Picks the earliest
 * near-maximum peak (resists octave-down slips) with parabolic
 * interpolation for sub-sample accuracy. Returns null for silence
 * and unpitched content.
 */
function detectWindow(window: Float32Array, sampleRate: number): number | null {
  let mean = 0
  for (let i = 0; i < window.length; i++) mean += window[i]
  mean /= window.length
  const x = new Float32Array(window.length)
  let energy = 0
  for (let i = 0; i < window.length; i++) {
    const v = window[i] - mean
    x[i] = v
    energy += v * v
  }
  if (Math.sqrt(energy / window.length) < SILENCE_RMS) return null
  const minLag = Math.max(1, Math.floor(sampleRate / PITCH_MAX_HZ))
  const maxLag = Math.min(window.length - 2, Math.floor(sampleRate / PITCH_MIN_HZ))
  if (maxLag <= minLag + 1) return null
  const corr = new Float32Array(maxLag + 2)
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let i = 0; i + lag < window.length; i++) sum += x[i] * x[i + lag]
    corr[lag] = sum / energy
  }
  // Local maxima only: raw correlation stays ~1 at tiny lags for any
  // low-pitched signal, so threshold crossings alone would misread.
  let ceiling = 0
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] > ceiling) {
      ceiling = corr[lag]
    }
  }
  if (ceiling < MIN_WINDOW_CONFIDENCE) return null
  let best = -1
  for (let lag = minLag + 1; lag < maxLag; lag++) {
    if (corr[lag] > corr[lag - 1] && corr[lag] >= corr[lag + 1] && corr[lag] >= ceiling * PEAK_MARGIN) {
      best = lag
      break
    }
  }
  if (best < 0) return null
  // Parabolic interpolation around the peak.
  const left = corr[best - 1]
  const mid = corr[best]
  const right = corr[best + 1]
  const denom = left - 2 * mid + right
  const shift = denom === 0 ? 0 : Math.max(-0.5, Math.min(0.5, (0.5 * (left - right)) / denom))
  return frequencyToMidi(sampleRate / (best + shift))
}

/**
 * Base-pitch note of a decoded sample, or null when uncertain.
 * Reads several windows across the stable middle (skipping attack
 * and tail) and requires them to agree.
 */
export function analyzeSample(buffer: AudioBuffer): number | null {
  const data = buffer.getChannelData(0)
  const start = Math.floor(data.length * 0.1)
  const usable = data.subarray(start, Math.ceil(data.length * 0.9))
  if (usable.length < MIN_SAMPLES) return null
  const size = Math.min(WINDOW_SAMPLES, usable.length)
  const count = usable.length >= WINDOW_SAMPLES ? ANALYSIS_WINDOWS : 1
  const midis: number[] = []
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : Math.floor(((usable.length - size) * i) / (count - 1))
    const midi = detectWindow(usable.subarray(off, off + size), buffer.sampleRate)
    if (midi !== null) midis.push(midi)
  }
  if (midis.length < Math.max(1, Math.ceil(count / 2))) return null
  midis.sort((a, b) => a - b)
  if (midis[midis.length - 1] - midis[0] > WINDOW_AGREE_SEMITONES) return null
  return Math.round(midis[Math.floor(midis.length / 2)])
}
