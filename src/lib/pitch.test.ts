import { describe, expect, it } from 'vitest'
import { analyzeSample, frequencyToMidi } from './pitch.ts'

const SR = 44100

function sine(freq: number, seconds: number): Float32Array {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.sin((2 * Math.PI * freq * i) / SR) * 0.8
  return out
}

function noise(seconds: number): Float32Array {
  const n = Math.floor(SR * seconds)
  const out = new Float32Array(n)
  let seed = 12345
  for (let i = 0; i < n; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    out[i] = (seed / 0x40000000 - 1) * 0.8
  }
  return out
}

function bufferOf(data: Float32Array): AudioBuffer {
  return { sampleRate: SR, getChannelData: () => data } as unknown as AudioBuffer
}

describe('frequencyToMidi', () => {
  it('maps concert pitch', () => {
    expect(frequencyToMidi(440)).toBe(69)
    expect(frequencyToMidi(880)).toBe(81)
    expect(frequencyToMidi(261.63)).toBeCloseTo(60, 0)
  })
})

describe('analyzeSample', () => {
  it.each([
    ['A4', 440, 69],
    ['C4', 261.63, 60],
    ['E4', 329.63, 64],
    ['A2', 110, 45],
    ['A5', 880, 81],
  ])('reads %s from a clean tone', (_name, freq, midi) => {
    expect(analyzeSample(bufferOf(sine(freq, 1)))).toBe(midi)
  })

  it('reads short tones from a single window', () => {
    expect(analyzeSample(bufferOf(sine(440, 0.06)))).toBe(69)
  })

  it('rejects noise, silence, and stubs', () => {
    expect(analyzeSample(bufferOf(noise(1)))).toBeNull()
    expect(analyzeSample(bufferOf(new Float32Array(SR)))).toBeNull()
    expect(analyzeSample(bufferOf(sine(440, 0.01)))).toBeNull()
  })
})
