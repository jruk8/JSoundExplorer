import { useEffect, useRef, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { buildResourceUrl, pickVariant } from '../lib/catalog.ts'
import { CLASSICAL_END_TAIL_MS, CLASSICAL_RELEASE_MS, CLASSICAL_TICK_MS } from '../lib/interaction.ts'
import type { MidiNote } from '../lib/midi.ts'
import { CLASSICAL_PIECE_URLS, MIDI_CENTER_NOTE, notePlaybackRate, parseMidi } from '../lib/midi.ts'
import { analyzeSample, sampleProxyUrl } from '../lib/pitch.ts'
import { playRemoteUrl } from '../lib/playback.ts'

export interface ClassicalOptions {
  /** Latest history sound; the piece performs on one variant of it. */
  soundKey: string | null
  pitch: number
  volume: number
  catalog: SoundCatalog | null
  resolveMember: (key: string) => string
  stopPlayback: () => void
}

interface ActiveNote {
  el: HTMLAudioElement
  midi: number
  velocity: number
  releaseTimer?: number
}

interface PendingEnd {
  endMs: number
  rec: ActiveNote
}

/** Release-ramp granularity for note-off fades. */
const RELEASE_STEP_MS = 20

/**
 * Classical performance: a random bundled MIDI piece on the latest
 * history sound. The sample's base pitch is detected up front so the
 * piece plays in its real key (middle C when detection fails). One
 * lookahead tick fires due notes; new notes never cut ringing ones,
 * they overlap freely, and each note-off releases with a short fade
 * tail instead of a hard cut. The pitch/volume sliders retune live
 * notes. Notes are internal: no history, no play counts.
 */
export function useClassical({
  soundKey,
  pitch,
  volume,
  catalog,
  resolveMember,
  stopPlayback,
}: ClassicalOptions) {
  const [playing, setPlayingState] = useState(false)
  const playingRef = useRef(false)
  const latestRef = useRef({ soundKey, pitch, volume, catalog, resolveMember, stopPlayback })
  latestRef.current = { soundKey, pitch, volume, catalog, resolveMember, stopPlayback }
  const runRef = useRef(0)
  const switchRef = useRef(0)
  const timerRef = useRef<number | undefined>(undefined)
  const startRef = useRef(0)
  const notesRef = useRef<MidiNote[]>([])
  const indexRef = useRef(0)
  const durationRef = useRef(0)
  const urlRef = useRef('')
  const anchorRef = useRef(MIDI_CENTER_NOTE)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const activeRef = useRef(new Set<ActiveNote>())
  const releasingRef = useRef(new Set<ActiveNote>())
  const endsRef = useRef<PendingEnd[]>([])

  function setPlaying(next: boolean) {
    playingRef.current = next
    setPlayingState(next)
  }

  function silence() {
    for (const rec of activeRef.current) {
      rec.el.onended = null
      try {
        rec.el.pause()
      } catch {
        // Already stopped.
      }
    }
    activeRef.current.clear()
    for (const rec of releasingRef.current) {
      if (rec.releaseTimer !== undefined) window.clearInterval(rec.releaseTimer)
      rec.releaseTimer = undefined
      rec.el.onended = null
      try {
        rec.el.pause()
      } catch {
        // Already stopped.
      }
    }
    releasingRef.current.clear()
    endsRef.current = []
  }

  function finish() {
    runRef.current++
    window.clearInterval(timerRef.current)
    timerRef.current = undefined
    silence()
    setPlaying(false)
  }

  function stop() {
    if (!playingRef.current) return
    finish()
  }

  function fireNote(note: MidiNote) {
    const { pitch: p, volume: v } = latestRef.current
    const el = playRemoteUrl(
      urlRef.current,
      notePlaybackRate(note.midi, p, anchorRef.current),
      (v * note.velocity) / 127,
    )
    if (!el) return
    const rec: ActiveNote = { el, midi: note.midi, velocity: note.velocity }
    el.onended = () => {
      activeRef.current.delete(rec)
    }
    activeRef.current.add(rec)
    endsRef.current.push({ endMs: note.ms + note.durationMs, rec })
  }

  /** Note-off: linear release ramp to silence, then pause. */
  function releaseNote(rec: ActiveNote) {
    if (!activeRef.current.delete(rec)) return
    rec.el.onended = null
    let from = 0
    try {
      from = rec.el.volume
    } catch {
      // Element already gone.
    }
    if (from <= 0) {
      try {
        rec.el.pause()
      } catch {
        // Already stopped.
      }
      return
    }
    releasingRef.current.add(rec)
    const steps = Math.max(1, Math.round(CLASSICAL_RELEASE_MS / RELEASE_STEP_MS))
    let i = 0
    rec.releaseTimer = window.setInterval(() => {
      i++
      if (i >= steps) {
        if (rec.releaseTimer !== undefined) window.clearInterval(rec.releaseTimer)
        rec.releaseTimer = undefined
        releasingRef.current.delete(rec)
        try {
          rec.el.volume = 0
        } catch {
          // Element already gone.
        }
        try {
          rec.el.pause()
        } catch {
          // Already stopped.
        }
        return
      }
      try {
        rec.el.volume = from * (1 - i / steps)
      } catch {
        // Element gone; the countdown still finishes the release.
      }
    }, RELEASE_STEP_MS)
  }

  function cutExpired(elapsed: number) {
    const kept: PendingEnd[] = []
    for (const end of endsRef.current) {
      if (end.endMs > elapsed) {
        kept.push(end)
        continue
      }
      releaseNote(end.rec)
    }
    endsRef.current = kept
  }

  function tick() {
    const elapsed = performance.now() - startRef.current
    const notes = notesRef.current
    let i = indexRef.current
    while (i < notes.length && notes[i].ms <= elapsed) {
      fireNote(notes[i])
      i++
    }
    indexRef.current = i
    cutExpired(elapsed)
    if (
      i >= notes.length &&
      ((activeRef.current.size === 0 && releasingRef.current.size === 0) ||
        elapsed > durationRef.current + CLASSICAL_END_TAIL_MS)
    ) {
      finish()
    }
  }

  /**
   * Base-pitch note of a sample, detected from proxied bytes (the CDN
   * sends no CORS headers). Null on any failure — no API, no WebAudio,
   * unpitched sample — so callers keep their current anchor.
   */
  async function detectAnchor(hash: string): Promise<number | null> {
    try {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return null
      if (!audioCtxRef.current) audioCtxRef.current = new AC()
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume()
        } catch {
          return null
        }
      }
      const res = await fetch(sampleProxyUrl(hash))
      if (!res.ok) return null
      const decoded = await ctx.decodeAudioData(await res.arrayBuffer())
      return analyzeSample(decoded)
    } catch {
      return null
    }
  }

  async function loadPiece(piece: string): Promise<ReturnType<typeof parseMidi>> {
    const res = await fetch(piece)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return parseMidi(new Uint8Array(await res.arrayBuffer()))
  }

  function start() {
    const { soundKey: key, catalog: cat } = latestRef.current
    if (playingRef.current || !key || !cat) return
    const variants = cat[latestRef.current.resolveMember(key)]
    if (!variants || variants.length === 0) return
    const variant = pickVariant(variants)
    const run = ++runRef.current
    latestRef.current.stopPlayback()
    setPlaying(true)
    const piece =
      CLASSICAL_PIECE_URLS[Math.floor(Math.random() * CLASSICAL_PIECE_URLS.length)]
    void (async () => {
      try {
        const [parsed, detected] = await Promise.all([
          loadPiece(piece),
          detectAnchor(variant.hash),
        ])
        if (!parsed || parsed.notes.length === 0) throw new Error('unplayable piece')
        if (runRef.current !== run) return
        anchorRef.current = detected ?? MIDI_CENTER_NOTE
        urlRef.current = buildResourceUrl(variant.hash)
        notesRef.current = parsed.notes
        durationRef.current = parsed.durationMs
        indexRef.current = 0
        startRef.current = performance.now()
        window.clearInterval(timerRef.current)
        timerRef.current = window.setInterval(tick, CLASSICAL_TICK_MS)
        tick()
      } catch {
        if (runRef.current === run) finish()
      }
    })()
  }

  function toggle() {
    if (playingRef.current) stop()
    else start()
  }

  // Mid-performance sound switch: a newly picked sound scores the rest
  // of the piece (ringing notes keep their sample). The anchor
  // re-detects so the new sound plays in its own key.
  useEffect(() => {
    if (!playingRef.current || !soundKey) return
    const run = runRef.current
    const swing = ++switchRef.current
    const variants = latestRef.current.catalog?.[latestRef.current.resolveMember(soundKey)]
    if (!variants || variants.length === 0) return
    const hash = pickVariant(variants).hash
    urlRef.current = buildResourceUrl(hash)
    void detectAnchor(hash).then((anchor) => {
      if (
        anchor !== null &&
        playingRef.current &&
        runRef.current === run &&
        switchRef.current === swing
      ) {
        anchorRef.current = anchor
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soundKey])

  // Live mix: slider moves retune the ringing notes.
  useEffect(() => {
    for (const { el, midi, velocity } of activeRef.current) {
      try {
        el.playbackRate = notePlaybackRate(midi, pitch, anchorRef.current)
        el.volume = Math.min(1, Math.max(0, ((volume * velocity) / 127 / 100)))
      } catch {
        // Element already gone; nothing to adjust.
      }
    }
  }, [pitch, volume])

  // Escape stops the performance (the playback hook stops its own sound).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  useEffect(() => {
    return () => {
      runRef.current++
      window.clearInterval(timerRef.current)
      silence()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { playing, toggle, stop }
}
