import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FLUSH_MS,
  REFRESH_MS,
  beaconPlayCounts,
  fetchPlayCounts,
  postPlayCounts,
} from '../lib/playcounts.ts'

function withoutSnapshot(
  prev: Record<string, number>,
  snapshot: Record<string, number>,
): Record<string, number> {
  const next = { ...prev }
  for (const id of Object.keys(snapshot)) {
    const left = (next[id] ?? 0) - (snapshot[id] ?? 0)
    if (left > 0) next[id] = left
    else delete next[id]
  }
  return next
}

/** Play counts: optimistic local view, batched upload, polled totals. */
export function usePlayCounts() {
  const [server, setServer] = useState<Record<string, number>>({})
  const [pending, setPending] = useState<Record<string, number>>({})
  const pendingRef = useRef(pending)
  pendingRef.current = pending

  const counts = useMemo(() => {
    const merged: Record<string, number> = { ...server }
    for (const [id, n] of Object.entries(pending)) {
      merged[id] = (merged[id] ?? 0) + n
    }
    return merged
  }, [server, pending])

  function recordPlay(id: string) {
    setPending((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }

  async function flush() {
    const snapshot = pendingRef.current
    if (Object.keys(snapshot).length === 0) return
    try {
      await postPlayCounts(snapshot)
    } catch {
      return // Keep pending; retry on the next interval.
    }
    setPending((prev) => withoutSnapshot(prev, snapshot))
    setServer((prev) => {
      const next = { ...prev }
      for (const [id, n] of Object.entries(snapshot)) {
        next[id] = (next[id] ?? 0) + n
      }
      return next
    })
  }
  const flushRef = useRef(flush)
  flushRef.current = flush

  async function refresh() {
    try {
      setServer(await fetchPlayCounts())
    } catch {
      // API unreachable (bare vite dev, DB booting): keep stale counts.
    }
  }
  const refreshRef = useRef(refresh)
  refreshRef.current = refresh

  useEffect(() => {
    void refreshRef.current()
    const flushTimer = window.setInterval(() => void flushRef.current(), FLUSH_MS)
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshRef.current()
    }, REFRESH_MS)
    const onHide = () => {
      const snapshot = pendingRef.current
      if (Object.keys(snapshot).length === 0) return
      // Beacon is fire-and-forget: clear on queue, accept rare loss.
      if (beaconPlayCounts(snapshot)) {
        setPending((prev) => withoutSnapshot(prev, snapshot))
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
      else void refreshRef.current()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(flushTimer)
      window.clearInterval(refreshTimer)
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return { counts, recordPlay }
}
