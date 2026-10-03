// Standard MIDI File reader for the bundled classical pieces: parses SMF
// bytes into a millisecond-timed note list. Anything malformed or
// unsupported (SMPTE timing, format 2) yields null.

import beethovenFurEliseUrl from '../assets/midis/beethoven-fur-elise.mid?url'
import beethovenMoonlight1stUrl from '../assets/midis/beethoven-moonlight-1st.mid?url'
import beethovenMoonlight2ndUrl from '../assets/midis/beethoven-moonlight-2nd.mid?url'
import beethovenMoonlight3rdUrl from '../assets/midis/beethoven-moonlight-3rd.midi?url'
import chopinImpromptuUrl from '../assets/midis/chopin-op66posth-impromptu.midi?url'
import chopinNocturneUrl from '../assets/midis/chopin-op9no2-eflat.mid?url'
import mozartK331Url from '../assets/midis/mozart-k331-3rd.mid?url'
import rachmaninoffOp3No2Url from '../assets/midis/rachmaninoff-op3no2.mid?url'
import { CLASSICAL_OPEN_NOTE_MS } from './interaction.ts'

/** Bundled classical pieces; one is picked at random per performance. */
export const CLASSICAL_PIECE_URLS: readonly string[] = [
  beethovenFurEliseUrl,
  beethovenMoonlight1stUrl,
  beethovenMoonlight2ndUrl,
  beethovenMoonlight3rdUrl,
  chopinImpromptuUrl,
  chopinNocturneUrl,
  mozartK331Url,
  rachmaninoffOp3No2Url,
]

export interface MidiNote {
  /** Start time within the piece. */
  ms: number
  /** MIDI pitch, 0-127. */
  midi: number
  /** Strike velocity, 1-127. */
  velocity: number
  /** Note-off lands this far after the start. */
  durationMs: number
}

export interface MidiPiece {
  /** Notes sorted by start time. */
  notes: MidiNote[]
  durationMs: number
}

/** MIDI note played back unshifted (rate = slider pitch). */
export const MIDI_CENTER_NOTE = 60
/** Sample-rate clamps: outside this a note is a click or a chipmunk. */
export const MIDI_MIN_RATE = 0.0625
export const MIDI_MAX_RATE = 16

const DEFAULT_TEMPO_US = 500000
const PERCUSSION_CHANNEL = 9
const MAX_TRACKS = 64

/**
 * Sample rate for a MIDI pitch at the slider pitch. The anchor is the
 * sample's own base-pitch note (middle C when unknown): the anchor
 * note plays back unshifted.
 */
export function notePlaybackRate(midi: number, pitch: number, anchor = MIDI_CENTER_NOTE): number {
  const rate = pitch * Math.pow(2, (midi - anchor) / 12)
  return Math.min(MIDI_MAX_RATE, Math.max(MIDI_MIN_RATE, rate))
}

interface TempoMark {
  tick: number
  usPerQuarter: number
}

interface RawNote {
  tick: number
  /** -1 when no note-off closed it. */
  endTick: number
  midi: number
  velocity: number
}

interface PedalMark {
  tick: number
  down: boolean
}

/** Bounds-checked cursor; every read fails soft to null/false. */
class Reader {
  private pos = 0

  constructor(private readonly bytes: Uint8Array) {}

  get remaining(): number {
    return this.bytes.length - this.pos
  }

  u8(): number | null {
    if (this.pos >= this.bytes.length) return null
    return this.bytes[this.pos++]
  }

  u16(): number | null {
    const hi = this.u8()
    const lo = this.u8()
    if (hi === null || lo === null) return null
    return hi * 256 + lo
  }

  u32(): number | null {
    const a = this.u8()
    const b = this.u8()
    const c = this.u8()
    const d = this.u8()
    if (a === null || b === null || c === null || d === null) return null
    return ((a * 256 + b) * 256 + c) * 256 + d
  }

  tag(expected: string): boolean {
    for (let i = 0; i < expected.length; i++) {
      if (this.u8() !== expected.charCodeAt(i)) return false
    }
    return true
  }

  /** Variable-length quantity; null on truncation or overflow. */
  varlen(): number | null {
    let value = 0
    for (let i = 0; i < 4; i++) {
      const b = this.u8()
      if (b === null) return null
      value = value * 128 + (b & 0x7f)
      if ((b & 0x80) === 0) return value
    }
    return null
  }

  skip(n: number): boolean {
    if (n < 0 || this.pos + n > this.bytes.length) return false
    this.pos += n
    return true
  }

  slice(n: number): Uint8Array | null {
    if (n < 0 || this.pos + n > this.bytes.length) return null
    const view = this.bytes.subarray(this.pos, this.pos + n)
    this.pos += n
    return view
  }
}

function parseTrackBody(
  body: Uint8Array,
  tempos: TempoMark[],
  raws: RawNote[],
  pedals: PedalMark[],
): boolean {
  const r = new Reader(body)
  let tick = 0
  let running = 0
  const open = new Map<number, { tick: number; velocity: number }[]>()
  while (r.remaining > 0) {
    const delta = r.varlen()
    if (delta === null) return false
    tick += delta
    let status = r.u8()
    if (status === null) return false
    let firstData: number | null = null
    if (status < 0x80) {
      // Running status: the byte read is the first data byte.
      firstData = status
      status = running
      if (status < 0x80 || status >= 0xf0) return false
    }
    if (status === 0xff) {
      const meta = r.u8()
      const len = r.varlen()
      if (meta === null || len === null) return false
      if (meta === 0x51 && len === 3) {
        const a = r.u8()
        const b = r.u8()
        const c = r.u8()
        if (a === null || b === null || c === null) return false
        const us = (a * 256 + b) * 256 + c
        if (us > 0) tempos.push({ tick, usPerQuarter: us })
      } else if (!r.skip(len)) {
        return false
      }
      running = 0
      if (meta === 0x2f) break
      continue
    }
    if (status === 0xf0 || status === 0xf7) {
      const len = r.varlen()
      if (len === null || !r.skip(len)) return false
      running = 0
      continue
    }
    if (status >= 0xf8) continue // Single-byte realtime; rare inside SMF.
    if (status < 0x80 || status >= 0xf0) return false
    running = status
    const channel = status & 0x0f
    const data1 = firstData ?? r.u8()
    if (data1 === null || data1 > 0x7f) return false
    const kind = status & 0xf0
    if (kind === 0xc0 || kind === 0xd0) continue // One data byte.
    const data2 = r.u8()
    if (data2 === null || data2 > 0x7f) return false
    // Sustain pedal, merged across channels: any damper down sustains.
    if (kind === 0xb0 && data1 === 64) {
      pedals.push({ tick, down: data2 >= 64 })
      continue
    }
    if (channel === PERCUSSION_CHANNEL) continue
    const key = channel * 128 + data1
    if (kind === 0x90 && data2 > 0) {
      const stack = open.get(key) ?? []
      stack.push({ tick, velocity: data2 })
      open.set(key, stack)
    } else if (kind === 0x80 || kind === 0x90) {
      const start = open.get(key)?.pop()
      if (start) raws.push({ tick: start.tick, endTick: tick, midi: data1, velocity: start.velocity })
    }
  }
  // Dangling note-ons ring briefly rather than forever.
  for (const [key, stack] of open) {
    for (const start of stack) {
      raws.push({ tick: start.tick, endTick: -1, midi: key % 128, velocity: start.velocity })
    }
  }
  return true
}

/**
 * Stretch note-offs landing under a down pedal to the next lift (or
 * the piece end when the pedal never lifts). Dangling note-ons keep
 * their short default ring.
 */
function applyPedal(notes: RawNote[], pedals: PedalMark[]): RawNote[] {
  if (pedals.length === 0) return notes
  const marks = [...pedals].sort((a, b) => a.tick - b.tick)
  let pieceEnd = 0
  for (const n of notes) pieceEnd = Math.max(pieceEnd, n.tick, n.endTick)
  for (const m of marks) pieceEnd = Math.max(pieceEnd, m.tick)
  const regions: Array<[number, number]> = []
  let downAt = -1
  for (const m of marks) {
    if (m.down) {
      if (downAt < 0) downAt = m.tick
    } else if (downAt >= 0) {
      regions.push([downAt, m.tick])
      downAt = -1
    }
  }
  if (downAt >= 0) regions.push([downAt, pieceEnd])
  return notes.map((n) => {
    if (n.endTick < 0) return n
    for (const [start, end] of regions) {
      if (n.endTick >= start && n.endTick < end) return { ...n, endTick: end }
    }
    return n
  })
}

/** Tick clock over the tempo map (default 120bpm before the first mark). */
function buildClock(tempos: TempoMark[], ticksPerQuarter: number): (tick: number) => number {
  const marks = [...tempos].sort((a, b) => a.tick - b.tick)
  const cuts: { tick: number; ms: number; usPerQuarter: number }[] = [
    { tick: 0, ms: 0, usPerQuarter: DEFAULT_TEMPO_US },
  ]
  for (const m of marks) {
    const prev = cuts[cuts.length - 1]
    const dt = Math.max(0, m.tick - prev.tick)
    cuts.push({
      tick: m.tick,
      ms: prev.ms + ((dt * prev.usPerQuarter) / ticksPerQuarter / 1000),
      usPerQuarter: m.usPerQuarter,
    })
  }
  return (tick: number) => {
    let seg = cuts[0]
    for (const c of cuts) {
      if (c.tick <= tick) seg = c
      else break
    }
    const dt = Math.max(0, tick - seg.tick)
    return seg.ms + ((dt * seg.usPerQuarter) / ticksPerQuarter / 1000)
  }
}

/** Parse SMF bytes into a timed piece, or null when unusable. */
export function parseMidi(bytes: Uint8Array): MidiPiece | null {
  const r = new Reader(bytes)
  if (!r.tag('MThd')) return null
  const headerLen = r.u32()
  if (headerLen === null || headerLen < 6) return null
  const format = r.u16()
  const trackCount = r.u16()
  const division = r.u16()
  if (format === null || trackCount === null || division === null) return null
  if (!r.skip(headerLen - 6)) return null
  if (format === 2 || (division & 0x8000) !== 0) return null
  if (trackCount === 0 || trackCount > MAX_TRACKS) return null
  const tempos: TempoMark[] = []
  const raws: RawNote[] = []
  const pedals: PedalMark[] = []
  for (let i = 0; i < trackCount; i++) {
    if (!r.tag('MTrk')) return null
    const length = r.u32()
    if (length === null) return null
    const body = r.slice(length)
    if (body === null) return null
    if (!parseTrackBody(body, tempos, raws, pedals)) return null
  }
  if (raws.length === 0) return null
  const toMs = buildClock(tempos, division)
  const notes = applyPedal(raws, pedals).map((n) => {
    const ms = toMs(n.tick)
    const endMs = n.endTick < 0 ? ms + CLASSICAL_OPEN_NOTE_MS : Math.max(ms, toMs(n.endTick))
    return { ms, midi: n.midi, velocity: n.velocity, durationMs: endMs - ms }
  })
  notes.sort((a, b) => a.ms - b.ms)
  const durationMs = notes.reduce((m, n) => Math.max(m, n.ms + n.durationMs), 0)
  return { notes, durationMs }
}
