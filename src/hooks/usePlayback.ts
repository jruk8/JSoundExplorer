import { useEffect, useRef, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { buildResourceUrl, pickVariant } from '../lib/catalog.ts'
import { easeInQuart } from '../lib/interaction.ts'
import { mockBlipDurationMs, playMockBlip, playRemoteUrl } from '../lib/playback.ts'
import type { PlayHistoryEntry } from '../lib/preferences.ts'

export interface PlayOpts {
  pitch?: number
  volume?: number
  /** Internal sounds (vault fanfare): played but never logged to history. */
  internal?: boolean
  /** Fade-marked UI sounds: never cut abruptly (scheduled/micro fades). */
  fade?: boolean
}

/** Unpredictable interruptions crossfade under the new sound this long. */
export const MICRO_FADE_MS = 90
const FADE_STEP_MS = 16

interface ActiveFade {
  el: HTMLAudioElement
  timers: number[]
}

export interface PlaybackOptions {
  catalog: SoundCatalog | null
  offline: boolean
  pitch: number
  volume: number
  onPlay: (entry: PlayHistoryEntry) => void
}

/** Single-playback controller: at most one sound plays at a time. */
export function usePlayback({
  catalog,
  offline,
  pitch,
  volume,
  onPlay,
}: PlaybackOptions) {
  const [playingKey, setPlayingKeyState] = useState<string | null>(null)
  const playingRef = useRef<string | null>(null)
  const internalRef = useRef(false)
  const fadeMarkRef = useRef(false)
  const fadeStateRef = useRef<ActiveFade | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mockStopRef = useRef<(() => void) | null>(null)
  const mockTimerRef = useRef<number | undefined>(undefined)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function setPlaying(key: string | null) {
    playingRef.current = key
    if (key === null) {
      internalRef.current = false
      fadeMarkRef.current = false
    }
    setPlayingKeyState(key)
  }

  function isPlaying(): boolean {
    return playingRef.current !== null
  }

  /** True while an internal UI sound plays (exempt from list filtering). */
  function isInternalPlaying(): boolean {
    return internalRef.current
  }

  /** Cancel the pending fade, optionally only when it targets el. */
  function cancelFade(el?: HTMLAudioElement) {
    const active = fadeStateRef.current
    if (!active || (el !== undefined && active.el !== el)) return
    fadeStateRef.current = null
    for (const t of active.timers) window.clearTimeout(t)
  }

  /**
   * Ease-in-quart ramp of el from fromVolume to silence over durationMs,
   * landing exactly (the completion timeout, not the last step, finishes).
   * A superseded detached fade target is paused: nearly silent already.
   */
  function scheduleFade(
    el: HTMLAudioElement,
    fromVolume: number,
    durationMs: number,
    onDone: () => void,
  ) {
    const prev = fadeStateRef.current
    cancelFade()
    if (prev && prev.el !== audioRef.current && prev.el !== el) {
      try {
        prev.el.pause()
      } catch {
        // Already stopped.
      }
    }
    if (durationMs <= 0 || fromVolume <= 0) {
      onDone()
      return
    }
    const timers: number[] = []
    fadeStateRef.current = { el, timers }
    for (let at = FADE_STEP_MS; at < durationMs; at += FADE_STEP_MS) {
      const t = at
      timers.push(
        window.setTimeout(() => {
          if (fadeStateRef.current?.el !== el) return
          try {
            el.volume = fromVolume * (1 - easeInQuart(t / durationMs))
          } catch {
            // Element already gone; the completion still lands.
          }
        }, t),
      )
    }
    timers.push(
      window.setTimeout(() => {
        if (fadeStateRef.current?.el !== el) return
        fadeStateRef.current = null
        onDone()
      }, durationMs),
    )
  }

  /**
   * Fade the current fade-marked UI sound to silence over durationMs.
   * Callers schedule this when the interrupting sound is known in advance
   * (card flip, spotlight scroll) so the sting lands silent exactly on it.
   * Anything else playing (card sounds, silence) is left untouched.
   */
  function fadeOutCurrent(durationMs: number) {
    const el = audioRef.current
    if (!el || !fadeMarkRef.current || playingRef.current === null) return
    scheduleFade(el, el.volume, durationMs, () => {
      try {
        el.volume = 0
      } catch {
        // Already stopped.
      }
      try {
        el.pause()
      } catch {
        // Already stopped.
      }
      if (audioRef.current === el) setPlaying(null)
    })
  }

  function stopCurrent() {
    const fading = fadeStateRef.current
    cancelFade()
    if (fading && fading.el !== audioRef.current) {
      try {
        fading.el.pause()
      } catch {
        // Already stopped.
      }
    }
    const audio = audioRef.current
    if (audio) {
      audio.onended = null
      audio.onerror = null
      try {
        audio.pause()
      } catch {
        // Already stopped.
      }
      audioRef.current = null
    }
    if (mockStopRef.current) {
      try {
        mockStopRef.current()
      } catch {
        // Already stopped.
      }
      mockStopRef.current = null
    }
    window.clearTimeout(mockTimerRef.current)
  }

  useEffect(() => {
    return () => {
      stopCurrent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Live mix: moving the pitch/volume sliders mid-play adjusts the
  // current sound. preservesPitch stays false on the element, so the
  // rate shifts real pitch.
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      try {
        audio.playbackRate = pitch
        audio.volume = Math.min(1, Math.max(0, volume / 100))
      } catch {
        // Element already gone; nothing to adjust.
      }
    }
    // Mock blips are 180ms; no human can drag a slider inside one.
  }, [pitch, volume])

  // Escape cancels any playing sound immediately.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        stop()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function play(key: string, opts?: PlayOpts) {
    const p = opts?.pitch ?? pitch
    const v = opts?.volume ?? volume
    const outgoing = audioRef.current
    const outgoingFade = fadeMarkRef.current && outgoing !== null
    internalRef.current = opts?.internal === true
    fadeMarkRef.current = opts?.fade === true
    if (outgoingFade && outgoing) {
      // Unpredictable interruption of a UI sting: detach it and crossfade
      // under the new sound instead of cutting (card sounds cut as before).
      const old = outgoing
      audioRef.current = null
      old.onended = null
      old.onerror = null
      scheduleFade(old, old.volume, MICRO_FADE_MS, () => {
        try {
          old.volume = 0
        } catch {
          // Already stopped.
        }
        try {
          old.pause()
        } catch {
          // Already stopped.
        }
      })
    } else {
      // Strictly one sound at a time: stop whatever is playing first.
      stopCurrent()
    }
    if (offline) {
      setPlaying(key)
      if (!opts?.internal) onPlay({ key, pitch: p, volume: v })
      // Highlight follows the blip duration even where WebAudio is missing.
      window.clearTimeout(mockTimerRef.current)
      mockTimerRef.current = window.setTimeout(() => {
        if (playingRef.current === key) setPlaying(null)
      }, mockBlipDurationMs(key, p))
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AC) return
      if (!audioCtxRef.current) {
        try {
          audioCtxRef.current = new AC()
        } catch {
          return
        }
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
      try {
        mockStopRef.current = playMockBlip(ctx, key, p, v)
      } catch {
        mockStopRef.current = null
      }
      return
    }
    const variants = catalog?.[key]
    if (!variants || variants.length === 0) {
      setPlaying(null)
      return
    }
    const variant = pickVariant(variants)
    const audio = playRemoteUrl(buildResourceUrl(variant.hash), p, v, () => {
      if (playingRef.current === key) setPlaying(null)
    })
    audioRef.current = audio
    if (!audio) {
      setPlaying(null)
      return
    }
    setPlaying(key)
    if (!opts?.internal) onPlay({ key, pitch: p, volume: v })
    audio.onended = () => {
      cancelFade(audio)
      if (playingRef.current === key) setPlaying(null)
    }
    audio.onerror = () => {
      cancelFade(audio)
      if (playingRef.current === key) setPlaying(null)
    }
  }

  function stop() {
    stopCurrent()
    setPlaying(null)
  }

  return { playingKey, play, stop, isPlaying, isInternalPlaying, fadeOutCurrent }
}
