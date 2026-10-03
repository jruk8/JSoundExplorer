import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/interaction.ts'
import { formatJmh } from '../lib/scripting.ts'

/** JMHScript panel behavior: selection-derived snippet plus copy blink. */
export function useJmh(pitch: number, volume: number) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [jmhCopied, setJmhCopied] = useState(false)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current)
    }
  }, [])

  const jmhText = selectedKey === null ? '' : formatJmh(selectedKey, pitch, volume)

  function selectKey(key: string) {
    setSelectedKey(key)
  }

  function copyJmh() {
    void copyText(jmhText).catch(() => {})
    window.clearTimeout(timerRef.current)
    setJmhCopied(true)
    timerRef.current = window.setTimeout(() => setJmhCopied(false), 600)
  }

  return { jmhText, jmhCopied, copyJmh, selectKey }
}
