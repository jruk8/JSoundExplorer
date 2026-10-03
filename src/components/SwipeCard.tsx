import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SwipeDirection } from '../lib/interaction.ts'
import { SWIPE_COMMIT_PX, SWIPE_REVEAL_MS, easeOutBack } from '../lib/interaction.ts'
import { PlayIcon, StopIcon } from './icons.tsx'

export interface SwipeCardProps {
  shortId: string
  playing: boolean
  onRevealPlay: () => void
  onCommit: (dir: SwipeDirection) => void
  onExit: (dir: SwipeDirection) => void
  onTogglePlay: () => void
}

interface DragSample {
  t: number
  x: number
  y: number
}

interface DragState {
  startX: number
  startY: number
  dx: number
  dy: number
  samples: DragSample[]
}

const PLAY_GREEN: [number, number, number] = [81, 192, 77]
const STOP_RED: [number, number, number] = [192, 77, 77]

/** White id text tinted green/red with drag distance, saturating at commit. */
function dragColor(dx: number): string {
  const f = Math.min(1, Math.abs(dx) / SWIPE_COMMIT_PX)
  const [r, g, b] = dx >= 0 ? PLAY_GREEN : STOP_RED
  const mix = (c: number) => Math.round(255 + (c - 255) * f)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

function sampleVelocity(samples: DragSample[]): { vx: number; vy: number } {
  const first = samples[0]
  const last = samples[samples.length - 1]
  const dt = Math.max(1, last.t - first.t)
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt }
}

export function SwipeCard({
  shortId,
  playing,
  onRevealPlay,
  onCommit,
  onExit,
  onTogglePlay,
}: SwipeCardProps) {
  const [ready, setReady] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const textRef = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef({ onRevealPlay, onCommit, onExit, onTogglePlay })
  latestRef.current = { onRevealPlay, onCommit, onExit, onTogglePlay }
  const dragRef = useRef<DragState | null>(null)
  const busyRef = useRef(false)
  const rafRef = useRef<number | undefined>(undefined)

  // Reveal: autoplay at the flip midpoint, settle to the static face at end.
  useEffect(() => {
    const midTimer = window.setTimeout(() => {
      latestRef.current.onRevealPlay()
    }, SWIPE_REVEAL_MS / 2)
    const endTimer = window.setTimeout(() => {
      setReady(true)
    }, SWIPE_REVEAL_MS)
    return () => {
      window.clearTimeout(midTimer)
      window.clearTimeout(endTimer)
      if (rafRef.current !== undefined && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  function setCardTransform(dx: number, dy: number, rot: number) {
    const el = cardRef.current
    if (el) {
      el.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`
    }
    const text = textRef.current
    if (text) {
      text.style.color = dragColor(dx)
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!ready || busyRef.current || e.button !== 0) return
    const el = cardRef.current
    if (!el) return
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      // Capture unsupported; moves still tracked while over the card.
    }
    const now = performance.now()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      dx: 0,
      dy: 0,
      samples: [{ t: now, x: e.clientX, y: e.clientY }],
    }
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag || busyRef.current) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    drag.dx = dx
    drag.dy = dy
    const now = performance.now()
    drag.samples.push({ t: now, x: e.clientX, y: e.clientY })
    while (drag.samples.length > 2 && now - drag.samples[0].t > 120) {
      drag.samples.shift()
    }
    const rot = Math.max(-20, Math.min(20, dx * 0.12))
    setCardTransform(dx, dy, rot)
  }

  function throwCard(
    dir: SwipeDirection,
    fromX: number,
    fromY: number,
    v: { vx: number; vy: number },
  ) {
    if (typeof requestAnimationFrame === 'undefined') {
      busyRef.current = false
      latestRef.current.onExit(dir)
      return
    }
    // Floor the fling so slow drags still exit; faster throws spin harder.
    const vx = dir === 'right' ? Math.max(0.9, v.vx) : Math.min(-0.9, v.vx)
    let vy = Math.max(-1.5, Math.min(1.5, v.vy))
    const spin = vx * 0.08
    const gravity = 0.0035
    const cardWidth = cardRef.current?.offsetWidth ?? 340
    const exitX = window.innerWidth / 2 + cardWidth / 2 + 48
    let x = fromX
    let y = fromY
    let rot = Math.max(-20, Math.min(20, fromX * 0.12))
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      x += vx * dt
      vy += gravity * dt
      y += vy * dt
      rot += spin * dt
      setCardTransform(x, y, rot)
      const off = dir === 'right' ? x > exitX : x < -exitX
      if (off) {
        busyRef.current = false
        rafRef.current = undefined
        latestRef.current.onExit(dir)
      } else {
        rafRef.current = requestAnimationFrame(frame)
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function bounceBack(fromX: number, fromY: number) {
    const fromRot = Math.max(-20, Math.min(20, fromX * 0.12))
    if (typeof requestAnimationFrame === 'undefined') {
      setCardTransform(0, 0, 0)
      busyRef.current = false
      return
    }
    const duration = 300
    let start: number | null = null
    const frame = (now: number) => {
      if (start === null) start = now
      const t = Math.min(1, (now - start) / duration)
      const k = easeOutBack(t)
      setCardTransform(fromX * (1 - k), fromY * (1 - k), fromRot * (1 - k))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        setCardTransform(0, 0, 0)
        busyRef.current = false
        rafRef.current = undefined
      }
    }
    rafRef.current = requestAnimationFrame(frame)
  }

  function endDrag(commit: boolean) {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag || busyRef.current) return
    const { dx, dy } = drag
    if (commit && Math.abs(dx) >= SWIPE_COMMIT_PX) {
      const dir: SwipeDirection = dx > 0 ? 'right' : 'left'
      busyRef.current = true
      latestRef.current.onCommit(dir)
      throwCard(dir, dx, dy, sampleVelocity(drag.samples))
    } else {
      busyRef.current = true
      bounceBack(dx, dy)
    }
  }

  function onPointerUp() {
    endDrag(true)
  }

  function onPointerCancel() {
    endDrag(false)
  }

  function renderBody() {
    return (
      <div className="swipe-body">
        <div ref={textRef} className="swipe-id">
          {shortId}
        </div>
        <div className="swipe-play-row">
          <button
            type="button"
            aria-label={playing ? 'Stop sound' : 'Play sound'}
            data-testid="swipe-play"
            className={playing ? 'swipe-play playing' : 'swipe-play'}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              latestRef.current.onTogglePlay()
            }}
          >
            {playing ? <StopIcon /> : <PlayIcon />}
          </button>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="swipe-enter">
        <div className="swipe-card entering">
          <div className="swipe-face swipe-front" aria-hidden="true">
            ?
          </div>
          <div className="swipe-face swipe-back">{renderBody()}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      className="swipe-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {renderBody()}
    </div>
  )
}
