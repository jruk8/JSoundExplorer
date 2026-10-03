import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/interaction.ts'
import type { JmhCommand } from '../lib/scripting.ts'
import { formatJmh } from '../lib/scripting.ts'

/** JMHScript panel: snippet for the latest history entry plus copy blink. */
export function useJmh(entryKey: string | null, pitch: number, volume: number) {
  const [jmhCopied, setJmhCopied] = useState(false)
  // Session-only command choice; deliberately not persisted.
  const [command, setCommand] = useState<JmhCommand>('psound')
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current)
    }
  }, [])

  const jmhText = entryKey === null ? '' : formatJmh(entryKey, pitch, volume, command)

  function copyJmh() {
    void copyText(jmhText).catch(() => {})
    window.clearTimeout(timerRef.current)
    setJmhCopied(true)
    timerRef.current = window.setTimeout(() => setJmhCopied(false), 600)
  }

  return { jmhText, jmhCopied, copyJmh, command, setCommand }
}
