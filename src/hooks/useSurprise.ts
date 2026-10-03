import { useEffect, useRef, useState } from 'react'
import {
  SURPRISE_CLICK_DELAY_MS,
  SURPRISE_PITCHES,
  SURPRISE_SCROLL_MS,
  easeOutCubic,
} from '../lib/interaction.ts'

export interface SurpriseOptions {
  keys: string[]
  setPitch: (pitch: number) => void
  onPick: (key: string, pitch: number | null) => void
  fadeOutCurrent: (durationMs: number) => void
}

/** Surprise-me sequencing: ease-out scroll, delayed auto-click, no repeats. */
export function useSurprise({ keys, setPitch, onPick, fadeOutCurrent }: SurpriseOptions) {
  const [surprisePitch, setSurprisePitch] = useState(false)
  const runRef = useRef(0)
  const rafRef = useRef<number | undefined>(undefined)
  const clickRef = useRef<number | undefined>(undefined)
  const lastPickRef = useRef<string | null>(null)
  const expectedYRef = useRef(0)
  const scrollGuardRef = useRef<(() => void) | null>(null)
  const latestRef = useRef({ keys, surprisePitch, setPitch, onPick, fadeOutCurrent })
  latestRef.current = { keys, surprisePitch, setPitch, onPick, fadeOutCurrent }

  function disarmScrollGuard() {
    if (scrollGuardRef.current !== null) {
      window.removeEventListener('scroll', scrollGuardRef.current)
      scrollGuardRef.current = null
    }
  }

  function cancelRun() {
    runRef.current += 1
    if (rafRef.current !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = undefined
    }
    window.clearTimeout(clickRef.current)
    disarmScrollGuard()
  }

  useEffect(() => {
    return () => {
      cancelRun()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function armScrollGuard() {
    disarmScrollGuard()
    expectedYRef.current = window.scrollY
    const guard = () => {
      // Our own animation updates the expectation with every jump, so any
      // larger deviation must be the user scrolling: cancel the surprise.
      if (Math.abs(window.scrollY - expectedYRef.current) > 2) {
        cancelRun()
      }
    }
    scrollGuardRef.current = guard
    window.addEventListener('scroll', guard, { passive: true })
  }

  /** Window scroll offset that centers a row, clamped to the page. */
  function centeredScrollY(el: Element): number {
    const rect = el.getBoundingClientRect()
    const targetY = window.scrollY + rect.top + rect.height / 2 - window.innerHeight / 2
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    return Math.min(Math.max(0, targetY), maxY)
  }

  /**
   * Ease-out scroll a row as close to viewport center as clamping allows.
   * Resolves false when no scrolling was needed at all.
   */
  function scrollToKeyCentered(key: string): Promise<boolean> {
    return new Promise((resolve) => {
      const el = document.querySelector(`[data-testid="sound-${key}"]`)
      const reduceMotion =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (!el) {
        resolve(false)
        return
      }
      const clamped = centeredScrollY(el)
      if (Math.abs(clamped - window.scrollY) < 1) {
        resolve(false)
        return
      }
      if (reduceMotion || typeof requestAnimationFrame === 'undefined') {
        expectedYRef.current = clamped
        window.scrollTo(0, clamped)
        resolve(true)
        return
      }
      const startY = window.scrollY
      const delta = clamped - startY
      const duration = SURPRISE_SCROLL_MS
      let start: number | null = null
      const frame = (now: number) => {
        if (start === null) start = now
        const t = Math.min(1, (now - start) / duration)
        const y = startY + delta * easeOutCubic(t)
        expectedYRef.current = y
        window.scrollTo(0, y)
        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame)
        } else {
          rafRef.current = undefined
          resolve(true)
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    })
  }

  function runToKey(choice: string, pitchToSet: number | null) {
    // Cancel any in-flight run.
    cancelRun()
    // A UI sting lands silent exactly on the auto-click; instant picks
    // supersede this with a micro crossfade instead.
    latestRef.current.fadeOutCurrent(SURPRISE_SCROLL_MS + SURPRISE_CLICK_DELAY_MS)
    const run = ++runRef.current
    // Apply pitch up front so state has settled before the auto-click.
    if (pitchToSet !== null) {
      latestRef.current.setPitch(pitchToSet)
    }
    armScrollGuard()
    void scrollToKeyCentered(choice).then((scrolled) => {
      if (runRef.current !== run) return
      if (!scrolled) {
        // Nothing to scroll: skip the interval too and click immediately.
        disarmScrollGuard()
        latestRef.current.onPick(choice, pitchToSet)
        return
      }
      clickRef.current = window.setTimeout(() => {
        if (runRef.current !== run) return
        disarmScrollGuard()
        latestRef.current.onPick(choice, pitchToSet)
      }, SURPRISE_CLICK_DELAY_MS)
    })
  }

  function surprise() {
    const { keys: currentKeys, surprisePitch: withPitch } = latestRef.current
    if (currentKeys.length === 0) return
    // Never pick the same sound twice in a row, unless it is the only one.
    const pool =
      currentKeys.length > 1 && lastPickRef.current !== null
        ? currentKeys.filter((k) => k !== lastPickRef.current)
        : currentKeys
    const choice = pool[Math.floor(Math.random() * pool.length)]
    lastPickRef.current = choice
    runToKey(
      choice,
      withPitch ? SURPRISE_PITCHES[Math.floor(Math.random() * SURPRISE_PITCHES.length)] : null,
    )
  }

  function spotlight(key: string, pitch: number) {
    runToKey(key, pitch)
  }

  /** Instant jump: kill everything in flight, center with no ease, pick now. */
  function jumpTo(key: string, pitch: number | null) {
    cancelRun()
    if (pitch !== null) {
      latestRef.current.setPitch(pitch)
    }
    const el = document.querySelector(`[data-testid="sound-${key}"]`)
    if (el) {
      window.scrollTo(0, centeredScrollY(el))
    }
    latestRef.current.onPick(key, pitch)
  }

  return { surprise, spotlight, jumpTo, surprisePitch, setSurprisePitch }
}
