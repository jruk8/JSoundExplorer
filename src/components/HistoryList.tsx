import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { cardTitle } from '../lib/catalog.ts'
import { DOUBLE_CLICK_MS } from '../lib/interaction.ts'
import type { PlayHistoryEntry } from '../lib/preferences.ts'
import { en } from '../locales/en.ts'
import { ScrollDownIcon, ScrollUpIcon } from './icons.tsx'

export interface HistoryListProps {
  entries: PlayHistoryEntry[]
  onSelect: (entry: PlayHistoryEntry) => void
  onInstant: (entry: PlayHistoryEntry) => void
}

/** Must match .history-item height: arrow buttons step exactly one row. */
const ROW_HEIGHT_PX = 28
/** Must match .history-arrow height: the track fills whatever remains. */
const ARROW_HEIGHT_PX = 20
const MIN_THUMB_PX = 20

/** Stored mix the JMHScript way: both values unless both are default. */
function mixLabel(entry: PlayHistoryEntry): string | null {
  if (entry.pitch === 1 && entry.volume === 100) return null
  return `${entry.pitch.toFixed(1)} ${(entry.volume / 100).toFixed(1)}`
}

export function HistoryList({ entries, onSelect, onInstant }: HistoryListProps) {
  const lastClickRef = useRef<{ key: string; time: number } | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const dragRef = useRef<{ startY: number; startTop: number } | null>(null)
  const repeatRef = useRef<number | undefined>(undefined)
  const [thumb, setThumb] = useState({ top: 0, height: 0, visible: false })

  function handleClick(entry: PlayHistoryEntry) {
    const now = Date.now()
    const last = lastClickRef.current
    if (last !== null && last.key === entry.key && now - last.time < DOUBLE_CLICK_MS) {
      lastClickRef.current = null
      onInstant(entry)
      return
    }
    lastClickRef.current = { key: entry.key, time: now }
    onSelect(entry)
  }

  function syncThumb() {
    const list = listRef.current
    if (!list) return
    const maxScroll = list.scrollHeight - list.clientHeight
    if (maxScroll <= 1) {
      setThumb((t) => (t.visible ? { top: 0, height: 0, visible: false } : t))
      return
    }
    const trackH = list.clientHeight - 2 * ARROW_HEIGHT_PX
    const height = Math.max(MIN_THUMB_PX, (trackH * list.clientHeight) / list.scrollHeight)
    const top = (list.scrollTop / maxScroll) * (trackH - height)
    setThumb({ top, height, visible: true })
  }

  useEffect(() => {
    syncThumb()
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => syncThumb())
    ro.observe(list)
    return () => {
      ro.disconnect()
      window.clearTimeout(repeatRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries])

  function step(dir: 1 | -1) {
    const list = listRef.current
    if (list) list.scrollTop += dir * ROW_HEIGHT_PX
  }

  function stopRepeat() {
    window.clearTimeout(repeatRef.current)
  }

  function startRepeat(dir: 1 | -1) {
    step(dir)
    stopRepeat()
    const tick = () => {
      step(dir)
      repeatRef.current = window.setTimeout(tick, 60)
    }
    repeatRef.current = window.setTimeout(tick, 350)
  }

  function onTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return
    const list = listRef.current
    if (!list) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    list.scrollTop += y < thumb.top ? -list.clientHeight : list.clientHeight
  }

  function onThumbPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // Capture unsupported; moves still tracked while over the thumb.
    }
    dragRef.current = { startY: e.clientY, startTop: listRef.current?.scrollTop ?? 0 }
  }

  function onThumbPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const list = listRef.current
    if (!drag || !list) return
    const maxScroll = list.scrollHeight - list.clientHeight
    const travel = list.clientHeight - 2 * ARROW_HEIGHT_PX - thumb.height
    if (travel <= 0) return
    list.scrollTop = drag.startTop + ((e.clientY - drag.startY) * maxScroll) / travel
  }

  function onThumbPointerUp() {
    dragRef.current = null
  }

  function arrowProps(dir: 1 | -1, label: string) {
    return {
      type: 'button' as const,
      'aria-label': label,
      className: 'history-arrow',
      onPointerDown: () => startRepeat(dir),
      onPointerUp: stopRepeat,
      onPointerLeave: stopRepeat,
      onPointerCancel: stopRepeat,
      // Keyboard activation fires click without a preceding pointerdown.
      onClick: (e: React.MouseEvent<HTMLButtonElement>) => {
        if (e.detail === 0) step(dir)
      },
    }
  }

  return (
    <div data-testid="history-list" className="history-scroll">
      <ul ref={listRef} className="history-items" onScroll={syncThumb}>
        {entries.length === 0 && <li className="history-empty">{en.options.historyEmpty}</li>}
        {entries.map((entry, i) => {
          const mix = mixLabel(entry)
          return (
            <li key={`${entry.key}:${i}`}>
              <button
                type="button"
                className="history-item"
                data-testid={`history-${entry.key}`}
                onClick={() => handleClick(entry)}
              >
                <span className="history-name">{cardTitle(entry.key)}</span>
                {mix !== null && <span className="history-mix">{mix}</span>}
              </button>
            </li>
          )
        })}
      </ul>
      {thumb.visible && (
        <div className="history-bar">
          <button {...arrowProps(-1, en.options.historyUp)}>
            <ScrollUpIcon />
          </button>
          <div className="history-track" onPointerDown={onTrackPointerDown}>
            <div
              className="history-thumb"
              style={{ top: thumb.top, height: thumb.height }}
              onPointerDown={onThumbPointerDown}
              onPointerMove={onThumbPointerMove}
              onPointerUp={onThumbPointerUp}
              onPointerCancel={onThumbPointerUp}
            />
          </div>
          <button {...arrowProps(1, en.options.historyDown)}>
            <ScrollDownIcon />
          </button>
        </div>
      )}
    </div>
  )
}
