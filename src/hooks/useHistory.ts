import { useEffect, useState } from 'react'
import type { PlayHistoryEntry } from '../lib/preferences.ts'
import { insertHistoryEntry, loadPlayHistory, savePlayHistory } from '../lib/preferences.ts'

/** Play history: newest-first log of played sounds, persisted locally. */
export function useHistory() {
  const [entries, setEntries] = useState<PlayHistoryEntry[]>(loadPlayHistory)

  useEffect(() => {
    savePlayHistory(entries)
  }, [entries])

  function record(entry: PlayHistoryEntry) {
    setEntries((prev) => insertHistoryEntry(prev, entry))
  }

  return { entries, record }
}
