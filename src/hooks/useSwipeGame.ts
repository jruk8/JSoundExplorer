import { useEffect, useRef, useState } from 'react'
import type { SwipeDirection } from '../lib/interaction.ts'
import { SURPRISE_PITCHES, SWIPE_OVERLAY_MS } from '../lib/interaction.ts'

export interface SwipeCardData {
  key: string
  pitch: number
}

export interface SwipeGameOptions {
  keys: string[]
  volume: number
  playingKey: string | null
  play: (key: string, opts?: { pitch?: number; volume?: number }) => void
  stop: () => void
  spotlight: (key: string, pitch: number) => void
}

/** Tinder-style swipe game: deck, rounds, runoff, winner spotlight. */
export function useSwipeGame({
  keys,
  volume,
  playingKey,
  play,
  stop,
  spotlight,
}: SwipeGameOptions) {
  const [active, setActive] = useState(false)
  const [closing, setClosing] = useState(false)
  const [overlayReady, setOverlayReady] = useState(false)
  const [deck, setDeck] = useState<SwipeCardData[]>([])
  const [index, setIndex] = useState(0)
  const [picks, setPicks] = useState<SwipeCardData[]>([])
  const [roundNo, setRoundNo] = useState(0)
  const overlayTimerRef = useRef<number | undefined>(undefined)
  const closeTimerRef = useRef<number | undefined>(undefined)
  const spotlightRef = useRef(spotlight)
  spotlightRef.current = spotlight

  useEffect(() => {
    return () => {
      window.clearTimeout(overlayTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  function closeGame(winner: SwipeCardData | null) {
    setClosing(true)
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      setActive(false)
      setClosing(false)
      setOverlayReady(false)
      setDeck([])
      setIndex(0)
      setPicks([])
      if (winner !== null) {
        spotlightRef.current(winner.key, winner.pitch)
      }
    }, SWIPE_OVERLAY_MS)
  }

  function open() {
    const pool = [...keys]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = pool[i]
      pool[i] = pool[j]
      pool[j] = tmp
    }
    const fresh = pool.slice(0, 6).map((key) => ({
      key,
      pitch: SURPRISE_PITCHES[Math.floor(Math.random() * SURPRISE_PITCHES.length)],
    }))
    if (fresh.length === 0) return
    stop()
    window.clearTimeout(overlayTimerRef.current)
    window.clearTimeout(closeTimerRef.current)
    setPicks([])
    setIndex(0)
    setRoundNo((n) => n + 1)
    setDeck(fresh)
    setClosing(false)
    setOverlayReady(false)
    setActive(true)
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlayReady(true)
    }, SWIPE_OVERLAY_MS)
  }

  function commitThrow(dir: SwipeDirection) {
    const card = deck[index]
    if (!card) return
    if (dir === 'right') {
      // Instant replay with a +15% power boost, stopping anything playing.
      play(card.key, { pitch: card.pitch, volume: volume * 1.15 })
    }
  }

  function exitThrow(dir: SwipeDirection) {
    const card = deck[index]
    if (!card) return
    const nextPicks = dir === 'right' ? [...picks, card] : picks
    const nextIndex = index + 1
    if (nextIndex < deck.length) {
      setPicks(nextPicks)
      setIndex(nextIndex)
      return
    }
    if (nextPicks.length === 0) {
      closeGame(null)
    } else if (nextPicks.length === 1) {
      closeGame(nextPicks[0])
    } else {
      // Runoff round with the picked cards (same pitches), seamlessly.
      setDeck(nextPicks)
      setPicks([])
      setIndex(0)
      setRoundNo((n) => n + 1)
    }
  }

  function togglePlay() {
    const card = deck[index]
    if (!card) return
    if (playingKey === card.key) {
      stop()
    } else {
      play(card.key, { pitch: card.pitch })
    }
  }

  function revealPlay() {
    const card = deck[index]
    if (!card) return
    play(card.key, { pitch: card.pitch })
  }

  const current = index < deck.length ? deck[index] : null

  return {
    active,
    closing,
    overlayReady,
    current,
    cardKey: `${roundNo}:${index}`,
    open,
    commitThrow,
    exitThrow,
    togglePlay,
    revealPlay,
  }
}
