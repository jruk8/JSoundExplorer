import { useEffect, useRef, useState } from 'react'
import type { PlayOpts } from './usePlayback.ts'
import type { SwipeDirection } from '../lib/interaction.ts'
import {
  SURPRISE_PITCHES,
  SWIPE_DISCARD_SOUND,
  SWIPE_OVERLAY_MS,
  SWIPE_UI_VOLUME_FACTOR,
  pickUiSound,
  pickVaultPitch,
  pickVaultSound,
} from '../lib/interaction.ts'

export interface SwipeCardData {
  key: string
  pitch: number
}

export interface SwipeGameOptions {
  keys: string[]
  /** Unfiltered catalog keys: UI sounds never depend on list filters. */
  soundPool: string[]
  volume: number
  pitch: number
  randomizePitch: boolean
  recordPlay: (key: string) => void
  playingKey: string | null
  play: (key: string, opts?: PlayOpts) => void
  stop: () => void
  spotlight: (key: string, pitch: number) => void
}

/** Fisher-Yates shuffle; each round reorders whatever cards remain. */
function shuffled<T>(items: T[]): T[] {
  const pool = [...items]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = pool[i]
    pool[i] = pool[j]
    pool[j] = tmp
  }
  return pool
}

/**
 * Reshuffle runoff picks so the previous round's last card never opens
 * the next round (swapped to a random later slot when it lands first).
 */
export function shuffleRunoff(cards: SwipeCardData[], lastKey: string): SwipeCardData[] {
  const next = shuffled(cards)
  if (next.length > 1 && next[0].key === lastKey) {
    const j = 1 + Math.floor(Math.random() * (next.length - 1))
    const tmp = next[0]
    next[0] = next[j]
    next[j] = tmp
  }
  return next
}

/** Tinder-style swipe game: deck, rounds, runoff, winner spotlight. */
export function useSwipeGame({
  keys,
  soundPool,
  volume,
  pitch,
  randomizePitch,
  recordPlay,
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

  useEffect(() => {
    if (!active || closing) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismiss()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  })

  function closeGame(winner: SwipeCardData | null) {
    setClosing(true)
    if (winner !== null) {
      const fanfare = pickUiSound(soundPool, 'block.copper_chest.copper_chest_open')
      if (fanfare !== null) {
        play(fanfare, {
          pitch: 1.1,
          volume: volume * SWIPE_UI_VOLUME_FACTOR,
          internal: true,
          fade: true,
        })
      }
    }
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

  function dismiss() {
    if (!active || closing) return
    closeGame(picks.length === 1 ? picks[0] : null)
  }

  function open() {
    const pool = shuffled(keys)
    const fresh = pool.slice(0, 6).map((key) => ({
      key,
      pitch: randomizePitch
        ? SURPRISE_PITCHES[Math.floor(Math.random() * SURPRISE_PITCHES.length)]
        : pitch,
    }))
    if (fresh.length === 0) return
    stop()
    window.clearTimeout(overlayTimerRef.current)
    window.clearTimeout(closeTimerRef.current)
    setPicks([])
    setIndex(0)
    // Fresh game, round 1: runoff rounds (2+) never close empty (see exitThrow).
    setRoundNo(1)
    setDeck(fresh)
    setClosing(false)
    setOverlayReady(false)
    setActive(true)
    // Sting up front, as the overlay starts darkening (not at card flip).
    slap()
    overlayTimerRef.current = window.setTimeout(() => {
      setOverlayReady(true)
    }, SWIPE_OVERLAY_MS)
  }

  function commitThrow(dir: SwipeDirection) {
    const card = deck[index]
    if (!card) return
    if (dir === 'right') {
      // Instant replay with a +15% power boost, stopping anything playing.
      play(card.key, { pitch: card.pitch, volume: volume * 1.15, fade: true })
      recordPlay(card.key)
      return
    }
    // Strictly step.snow: no fallback sting when it is uncataloged.
    if (soundPool.includes(SWIPE_DISCARD_SOUND)) {
      play(SWIPE_DISCARD_SOUND, {
        pitch: pickVaultPitch(),
        volume: volume * SWIPE_UI_VOLUME_FACTOR,
        internal: true,
        fade: true,
      })
    }
  }

  /** Round slap sting: the five random sounds, never logged. */
  function slap() {
    const sting = pickVaultSound(soundPool)
    if (sting !== null) {
      play(sting, {
        pitch: pickVaultPitch(),
        volume: volume * SWIPE_UI_VOLUME_FACTOR,
        internal: true,
        fade: true,
      })
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
      if (roundNo >= 2 && deck.length > 0) {
        // Runoff whitewash: crown a random finalist instead of closing empty.
        closeGame(deck[Math.floor(Math.random() * deck.length)])
      } else {
        closeGame(null)
      }
    } else if (nextPicks.length === 1) {
      closeGame(nextPicks[0])
    } else {
      // Runoff round with the picked cards (same pitches), reshuffled.
      setDeck(shuffleRunoff(nextPicks, card.key))
      setPicks([])
      setIndex(0)
      setRoundNo((n) => n + 1)
      slap()
    }
  }

  function togglePlay() {
    const card = deck[index]
    if (!card) return
    if (playingKey === card.key) {
      stop()
    } else {
      play(card.key, { pitch: card.pitch })
      recordPlay(card.key)
    }
  }

  function revealPlay() {
    const card = deck[index]
    if (!card) return
    play(card.key, { pitch: card.pitch })
    recordPlay(card.key)
  }

  const current = index < deck.length ? deck[index] : null

  return {
    active,
    closing,
    overlayReady,
    current,
    cardKey: `${roundNo}:${index}`,
    roundNo,
    cardsLeft: deck.length - index,
    discarded: index - picks.length,
    pickedCount: picks.length,
    open,
    dismiss,
    commitThrow,
    exitThrow,
    togglePlay,
    revealPlay,
  }
}
