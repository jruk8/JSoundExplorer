import { useEffect, useRef, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { buildResourceUrl, pickVariant } from '../lib/catalog.ts'
import { mockBlipDurationMs, playMockBlip, playRemoteUrl } from '../lib/playback.ts'

export interface PlaybackOptions {
  catalog: SoundCatalog | null
  offline: boolean
  pitch: number
  volume: number
}

/** Single-playback controller: at most one sound plays at a time. */
export function usePlayback({ catalog, offline, pitch, volume }: PlaybackOptions) {
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

  function play(key: string) {
    // Strictly one sound at a time: stop whatever is playing first.
    stopCurrent()
    if (offline) {
      setPlaying(key)
      // Highlight follows the blip duration even where WebAudio is missing.
      window.clearTimeout(mockTimerRef.current)
      mockTimerRef.current = window.setTimeout(() => {
        if (playingRef.current === key) setPlaying(null)
      }, mockBlipDurationMs(key, pitch))
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
        mockStopRef.current = playMockBlip(ctx, key, pitch, volume)
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
    const audio = playRemoteUrl(buildResourceUrl(variant.hash), pitch, volume, () => {
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

  return { playingKey, play, isPlaying }
}
