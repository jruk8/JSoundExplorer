// Audio playback primitives: remote ogg playback and offline mock blips.
// Browser APIs only; no React dependency.

import { mockWaveformForKey } from './catalog.ts'

const BASE_FREQUENCY: Record<string, number> = {
  sine: 440,
  square: 523.25,
  sawtooth: 659.25,
  triangle: 783.99,
}

export const MOCK_BLIP_DURATION_MS = 180

/**
 * Exact audible length of a mock blip. Oscillator blips always run the full
 * duration, but the noise buffer is consumed at the pitch rate (and hard
 * capped at the full duration), so pitched-up noise ends early.
 */
export function mockBlipDurationMs(key: string, pitch: number): number {
  if (mockWaveformForKey(key) !== 'noise' || pitch <= 1) return MOCK_BLIP_DURATION_MS
  return MOCK_BLIP_DURATION_MS / pitch
}

/**
 * Play an 8-bit style blip for a mock key. Distinct waveform per key.
 * Returns a stop function so callers can enforce one-sound-at-a-time.
 */
export function playMockBlip(
  ctx: AudioContext,
  key: string,
  pitch: number,
  volumePercent: number,
): () => void {
  const waveform = mockWaveformForKey(key)
  // No upper clamp here: the swipe boost intentionally drives past 1.0.
  const volume = Math.max(0, volumePercent / 100)
  const duration = MOCK_BLIP_DURATION_MS / 1000
  const now = ctx.currentTime

  if (waveform === 'noise') {
    const sampleRate = ctx.sampleRate
    const length = Math.floor(sampleRate * duration)
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      // 8-bit quantization for a retro crunch.
      const v = Math.random() * 2 - 1
      data[i] = Math.round(v * 127) / 127
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    // Pitch shifts noise playback rate.
    src.playbackRate.value = pitch
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(volume, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    src.connect(gain).connect(ctx.destination)
    src.start(now)
    src.stop(now + duration)
    return () => {
      try {
        src.stop()
      } catch {
        // Already stopped.
      }
      try {
        src.disconnect()
        gain.disconnect()
      } catch {
        // Already disconnected.
      }
    }
  }

  const osc = ctx.createOscillator()
  osc.type = waveform
  const suffix = key.split('.').pop() ?? 'sine'
  const base = BASE_FREQUENCY[suffix] ?? 440
  osc.frequency.setValueAtTime(base * pitch, now)
  // Slight downward chirp for a blip feel.
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, base * pitch * 0.75), now + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration)
  return () => {
    try {
      osc.stop()
    } catch {
      // Already stopped.
    }
    try {
      osc.disconnect()
      gain.disconnect()
    } catch {
      // Already disconnected.
    }
  }
}

/** Play a remote ogg variant URL with pitch/volume applied. */
export function playRemoteUrl(
  url: string,
  pitch: number,
  volumePercent: number,
  onFailed?: () => void,
): HTMLAudioElement | null {
  const fail = () => {
    try {
      onFailed?.()
    } catch {
      // Listener errors must not break playback handling.
    }
  }
  try {
    const audio = new Audio(url)
    audio.playbackRate = pitch
    // Resample instead of time-stretch: pitch must shift with the rate.
    // (Browsers default preservesPitch to true, which holds pitch constant.)
    audio.preservesPitch = false
    // Element volume caps at 1.0 (browser ceiling, not our limiter).
    audio.volume = Math.min(1, Math.max(0, volumePercent / 100))
    const result = audio.play() as unknown as Promise<void> | undefined
    // jsdom and autoplay policies may yield no promise or a rejection.
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // Playback rejected (e.g. autoplay policy): report so UI can revert.
        fail()
      })
    }
    return audio
  } catch {
    fail()
    return null
  }
}
