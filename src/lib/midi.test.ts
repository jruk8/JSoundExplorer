import { describe, expect, it } from 'vitest'
import { CLASSICAL_OPEN_NOTE_MS } from './interaction.ts'
import { MIDI_MAX_RATE, MIDI_MIN_RATE, notePlaybackRate, parseMidi } from './midi.ts'

function header(format: number, tracks: number, division: number): number[] {
  return [
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, format, 0, tracks,
    (division >> 8) & 0xff, division & 0xff,
  ]
}

function track(...body: number[]): number[] {
  const len = body.length
  return [
    0x4d, 0x54, 0x72, 0x6b,
    (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff,
    ...body,
  ]
}

const smf = (...bytes: number[]) => new Uint8Array(bytes)
const TEMPO_120 = [0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20]
const END = [0x00, 0xff, 0x2f, 0x00]

describe('parseMidi', () => {
  it('reads tempo, pitch, velocity, and duration', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 96),
        ...track(
          ...TEMPO_120,
          0x00, 0x90, 0x3c, 0x40,
          0x60, 0x80, 0x3c, 0x40,
          ...END,
        ),
      ),
    )
    expect(piece).not.toBeNull()
    expect(piece!.notes).toEqual([{ ms: 0, midi: 60, velocity: 64, durationMs: 500 }])
    expect(piece!.durationMs).toBe(500)
  })

  it('honors running status, velocity-zero offs, and skips percussion', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 96),
        ...track(
          ...TEMPO_120,
          0x00, 0x90, 0x3c, 0x40,
          0x30, 0x3e, 0x50, // running-status note-on, D4 at tick 48
          0x30, 0x90, 0x3c, 0x00, // velocity-zero note-off, C4 at tick 96
          0x00, 0x99, 0x24, 0x40, // channel 9: percussion, skipped
          0x30, 0x80, 0x3e, 0x40, // D4 off at tick 144
          ...END,
        ),
      ),
    )
    expect(piece!.notes).toEqual([
      { ms: 0, midi: 60, velocity: 64, durationMs: 500 },
      { ms: 250, midi: 62, velocity: 80, durationMs: 500 },
    ])
  })

  it('maps ticks through tempo changes', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 120),
        ...track(
          ...TEMPO_120,
          0x00, 0x90, 0x3c, 0x40,
          0x78, 0xff, 0x51, 0x03, 0x03, 0xd0, 0x90, // 250000us at tick 120
          0x78, 0x80, 0x3c, 0x40,
          ...END,
        ),
      ),
    )
    // 120 ticks at 120bpm (500ms) + 120 ticks at 240bpm (250ms).
    expect(piece!.notes[0].durationMs).toBe(750)
  })

  it('stretches note-offs under a down pedal to the lift', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 96),
        ...track(
          ...TEMPO_120,
          0x00, 0xb0, 0x40, 0x7f,
          0x00, 0x90, 0x3c, 0x40,
          0x30, 0x80, 0x3c, 0x40,
          0x60, 0xb0, 0x40, 0x00,
          ...END,
        ),
      ),
    )
    expect(piece!.notes).toEqual([{ ms: 0, midi: 60, velocity: 64, durationMs: 750 }])
  })

  it('leaves note-offs outside the pedal alone', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 96),
        ...track(
          ...TEMPO_120,
          0x00, 0x90, 0x3c, 0x40,
          0x30, 0x80, 0x3c, 0x40,
          0x0c, 0xb0, 0x40, 0x7f,
          0x30, 0xb0, 0x40, 0x00,
          ...END,
        ),
      ),
    )
    expect(piece!.notes[0].durationMs).toBe(250)
  })

  it('rings a never-lifted pedal to the piece end', () => {
    const piece = parseMidi(
      smf(
        ...header(0, 1, 96),
        ...track(
          ...TEMPO_120,
          0x00, 0xb0, 0x40, 0x7f,
          0x00, 0x90, 0x3c, 0x40,
          0x30, 0x80, 0x3c, 0x40,
          0x30, 0x90, 0x3e, 0x50,
          0x30, 0x80, 0x3e, 0x40,
          ...END,
        ),
      ),
    )
    expect(piece!.notes).toEqual([
      { ms: 0, midi: 60, velocity: 64, durationMs: 750 },
      { ms: 500, midi: 62, velocity: 80, durationMs: 250 },
    ])
  })

  it('rings dangling note-ons briefly instead of forever', () => {
    const piece = parseMidi(
      smf(...header(0, 1, 96), ...track(...TEMPO_120, 0x00, 0x90, 0x3c, 0x40, ...END)),
    )
    expect(piece!.notes[0].durationMs).toBe(CLASSICAL_OPEN_NOTE_MS)
  })

  it.each([
    ['bad magic', [0x00, 0x00, 0x00, 0x00]],
    ['truncated header', [0x4d, 0x54, 0x68, 0x64, 0, 0]],
    ['format 2', [...header(2, 1, 96), ...track(...TEMPO_120, ...END)]],
    ['smpte division', [...header(0, 1, 0xe728), ...track(...TEMPO_120, ...END)]],
    ['zero tracks', [...header(0, 0, 96)]],
    ['no notes', [...header(0, 1, 96), ...track(...TEMPO_120, ...END)]],
    ['truncated event', [...header(0, 1, 96), ...track(0x00, 0x90, 0x3c)]],
  ])('rejects %s', (_name, bytes) => {
    expect(parseMidi(smf(...bytes))).toBeNull()
  })
})

describe('notePlaybackRate', () => {
  it('centers middle C on the slider pitch', () => {
    expect(notePlaybackRate(60, 1)).toBe(1)
    expect(notePlaybackRate(72, 1)).toBe(2)
    expect(notePlaybackRate(48, 1)).toBe(0.5)
    expect(notePlaybackRate(60, 1.5)).toBe(1.5)
  })

  it('clamps extremes to the usable element range', () => {
    expect(notePlaybackRate(0, 0.1)).toBe(MIDI_MIN_RATE)
    expect(notePlaybackRate(127, 2)).toBe(MIDI_MAX_RATE)
  })

  it('shifts the unshifted note to a detected anchor', () => {
    expect(notePlaybackRate(69, 1, 69)).toBe(1)
    expect(notePlaybackRate(60, 1, 69)).toBeCloseTo(Math.pow(2, -9 / 12), 5)
  })
})
