import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  darkenColor,
  easeOutCubic,
  pickVaultPitch,
  pickVaultSound,
  vaultSeparation,
  vaultShouldOpen,
} from '../lib/interaction.ts'
import type { PlayOpts } from '../hooks/usePlayback.ts'

export interface VaultProps {
  keys: string[]
  version: string | null
  play: (key: string, opts?: PlayOpts) => void
  onDone: () => void
}

/** Vault paint: the live background color darkened 13%. */
function vaultColor(): string {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    return darkenColor(raw === '' ? '#1e2129' : raw, 0.87)
  } catch {
    return '#1a1d24'
  }
}

function reduceMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

interface DragState {
  startY: number
  dist: number
  lastT: number
  lastY: number
  vel: number
}

/** Red -------v------- seam; each half carries an identical copy. */
function VaultSeam({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points="0,2 40,2 50,18 60,2 100,2"
        fill="none"
        stroke="var(--accent)"
        strokeWidth={3}
        strokeLinejoin="miter"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

/** Vault intro: drag either way against exponential resistance, or just click. */
export function Vault({ keys, version, play, onDone }: VaultProps) {
  const [color] = useState(vaultColor)
  const [dragging, setDragging] = useState(false)
  const topRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const animRef = useRef<number | undefined>(undefined)
  const sepRef = useRef(0)
  const doneRef = useRef(false)
  const latestRef = useRef({ keys, play, onDone })
  latestRef.current = { keys, play, onDone }

  // Lock page scroll while sealed.
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      if (animRef.current !== undefined && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animRef.current)
      }
    }
  }, [])

  function setSeparation(px: number) {
    sepRef.current = px
    if (topRef.current) topRef.current.style.transform = `translateY(${-px}px)`
    if (bottomRef.current) bottomRef.current.style.transform = `translateY(${px}px)`
  }

  function animateTo(target: number, duration: number, then?: () => void) {
    if (animRef.current !== undefined && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(animRef.current)
      animRef.current = undefined
    }
    const from = sepRef.current
    if (duration <= 0 || typeof requestAnimationFrame === 'undefined') {
      setSeparation(target)
      then?.()
      return
    }
    let start: number | null = null
    const frame = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / duration)
      setSeparation(from + (target - from) * easeOutCubic(t))
      if (t < 1) {
        animRef.current = requestAnimationFrame(frame)
      } else {
        animRef.current = undefined
        then?.()
      }
    }
    animRef.current = requestAnimationFrame(frame)
  }

  function commitOpen() {
    if (doneRef.current) return
    doneRef.current = true
    dragRef.current = null
    setDragging(false)
    const { keys: pool, play: doPlay, onDone: done } = latestRef.current
    const fanfare = pickVaultSound(pool)
    if (fanfare !== null) {
      doPlay(fanfare, { pitch: pickVaultPitch(), volume: 100, internal: true })
    }
    const target = window.innerHeight / 2 + 60
    if (reduceMotion()) {
      setSeparation(target)
      done()
      return
    }
    animateTo(target, 380, done)
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (doneRef.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (reduceMotion()) {
      commitOpen()
      return
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture unsupported; moves still tracked while over the vault.
    }
    const now = performance.now()
    dragRef.current = {
      startY: e.clientY,
      dist: 0,
      lastT: now,
      lastY: e.clientY,
      vel: 0,
    }
    setDragging(true)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || doneRef.current) return
    const dist = Math.abs(e.clientY - drag.startY)
    const now = performance.now()
    const dt = Math.max(1, now - drag.lastT)
    const instant = (e.clientY - drag.lastY) / dt
    drag.vel = drag.vel * 0.6 + instant * 0.4
    drag.lastT = now
    drag.lastY = e.clientY
    drag.dist = dist
    setSeparation(vaultSeparation(dist, window.innerHeight / 2 + 60))
  }

  function endDrag(cancelled: boolean) {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!drag || doneRef.current) return
    if (cancelled) {
      animateTo(0, 260)
      return
    }
    if (vaultShouldOpen(drag.dist, drag.vel)) {
      commitOpen()
    } else {
      animateTo(0, 260)
    }
  }

  return (
    <div
      className={dragging ? 'vault dragging' : 'vault'}
      data-testid="vault"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => endDrag(false)}
      onPointerCancel={() => endDrag(true)}
    >
      <div ref={topRef} className="vault-half vault-top" style={{ background: color }}>
        <h1 className="vault-title">JSoundExplorer</h1>
        <VaultSeam className="vault-seam" />
      </div>
      <div ref={bottomRef} className="vault-half vault-bottom" style={{ background: color }}>
        <VaultSeam className="vault-seam vault-seam-bottom" />
        <p className="vault-subtitle">
          {version === null ? 'Minecraft sounds' : `Minecraft sounds for ${version}`}
        </p>
      </div>
    </div>
  )
}
