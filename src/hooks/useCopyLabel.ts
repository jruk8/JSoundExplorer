import { useEffect, useRef, useState } from 'react'
import {
  COPIED_BLUE_MS,
  COPIED_VISIBLE_MS,
  DOUBLE_CLICK_MS,
  copyText,
} from '../lib/interaction.ts'

export type ClickAction = 'copy' | 'play'

/**
 * Double-click tracking and the "copied to clipboard" label. A ref mirror of
 * the label state keeps decisions fresh inside delayed callbacks.
 */
export function useCopyLabel(isPlaying: () => boolean) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [copiedBlue, setCopiedBlue] = useState(true)
  const copiedKeyRef = useRef<string | null>(null)
  const lastClickRef = useRef<{ key: string; time: number } | null>(null)
  const hideTimeoutRef = useRef<number | undefined>(undefined)
  const phaseTimeoutRef = useRef<number | undefined>(undefined)
  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  useEffect(() => {
    return () => {
      window.clearTimeout(hideTimeoutRef.current)
      window.clearTimeout(phaseTimeoutRef.current)
    }
  }, [])

  function setCopied(key: string | null) {
    copiedKeyRef.current = key
    setCopiedKey(key)
  }

  function clearCopiedTimeouts() {
    window.clearTimeout(hideTimeoutRef.current)
    window.clearTimeout(phaseTimeoutRef.current)
  }

  function hideLabel() {
    clearCopiedTimeouts()
    setCopied(null)
  }

  /**
   * Resolve a click on a sound: dismiss a visible label, copy on double
   * click, or play. Mutates tracking state and returns the action taken.
   */
  function resolveClick(key: string, now: number): ClickAction {
    // A copied label is dismissed only by timeout or by clicking any sound.
    // The dismissing click also plays and restarts double-click tracking.
    if (copiedKeyRef.current !== null) {
      clearCopiedTimeouts()
      setCopied(null)
      lastClickRef.current = { key, time: now }
      return 'play'
    }

    const last = lastClickRef.current
    if (last && last.key === key && now - last.time < DOUBLE_CLICK_MS) {
      // Second click within 0.5s: copy, no replay.
      void copyText(key).catch(() => {})
      clearCopiedTimeouts()
      setCopied(key)
      setCopiedBlue(true)
      phaseTimeoutRef.current = window.setTimeout(() => setCopiedBlue(false), COPIED_BLUE_MS)
      if (!isPlayingRef.current()) {
        // No sound playing: fall back to the fixed visible duration.
        hideTimeoutRef.current = window.setTimeout(() => setCopied(null), COPIED_VISIBLE_MS)
      }
      // Otherwise the gray tail lasts as long as the sound plays: playback
      // end hides the label, cutting the accent phase short for very short
      // sounds.
      lastClickRef.current = null
      return 'copy'
    }

    lastClickRef.current = { key, time: now }
    return 'play'
  }

  return { copiedKey, copiedBlue, resolveClick, hideLabel }
}
