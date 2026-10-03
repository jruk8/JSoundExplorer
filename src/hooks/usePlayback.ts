import { useEffect, useRef, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { buildResourceUrl, pickVariant } from '../lib/catalog.ts'
import { mockBlipDurationMs, playMockBlip, playRemoteUrl } from '../lib/playback.ts'

export interface PlayOpts {
  pitch?: number
  volume?: number
}

export interface PlaybackOptions {
  catalog: SoundCatalog | null
  offline: boolean
  pitch: number
  volume: number
  resolveMember: (key: string) => string
}

/** Single-playback controller: at most one sound plays at a time. */
export function usePlayback({
  catalog,
  offline,
  pitch,
  volume,
  resolveMember,
}: PlaybackOptions) {
  const [playingKey, setPlayingKeyState] = useState<string | null>(null)
  const playingRef = useRef<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const mockStopRef = useRef<(() => void) | null>(null)
  const mockTimerRef = useRef<number | undefined>(undefined)
  const audioCtxRef = useRef<AudioContext | null>(null)

  function setPlaying(key: string | null) {
    playingRef.current = key
    setPlayingKeyState(key)
  }

  function isPlaying(): boolean {
    return playingRef.current !== null
  }

  function stopCurrent() {
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

  // Live pitch: moving the slider mid-play retunes the current sound.
  // preservesPitch stays false on the element, so the rate shifts pitch.
  useEffect(() => {
    const audio = audioRef.current
    if (audio) {
      try {
        audio.playbackRate = pitch
      } catch {
        // Element already gone; nothing to retune.
      }
    }
    // Mock blips are 180ms; no human can drag a slider inside one.
  }, [pitch])

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
    const member = resolveMember(key)
    // Strictly one sound at a time: stop whatever is playing first.
    stopCurrent()
    if (offline) {
      setPlaying(key)
      // Highlight follows the blip duration even where WebAudio is missing.
      window.clearTimeout(mockTimerRef.current)
      mockTimerRef.current = window.setTimeout(() => {
        if (playingRef.current === key) setPlaying(null)
      }, mockBlipDurationMs(member, p))
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
        mockStopRef.current = playMockBlip(ctx, member, p, v)
      } catch {
        mockStopRef.current = null
      }
      return
    }
    const variants = catalog?.[member]
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
    audio.onended = () => {
      if (playingRef.current === key) setPlaying(null)
    }
    audio.onerror = () => {
      if (playingRef.current === key) setPlaying(null)
    }
  }

  function stop() {
    stopCurrent()
    setPlaying(null)
  }

  return { playingKey, play, stop, isPlaying }
}
