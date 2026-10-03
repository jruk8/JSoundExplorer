// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useJmh } from './useJmh.ts'

describe('useJmh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is empty with no history entry', () => {
    const { result } = renderHook(() => useJmh(null, 1, 100))
    expect(result.current.jmhText).toBe('')
  })

  it('formats the history head key with live sliders', () => {
    const { result, rerender } = renderHook(({ entryKey, pitch }) => useJmh(entryKey, pitch, 100), {
      initialProps: { entryKey: 'a.b' as string | null, pitch: 1 },
    })
    expect(result.current.jmhText).toBe('<psound:<p>,a.b>')
    rerender({ entryKey: 'a.b', pitch: 1.2 })
    expect(result.current.jmhText).toBe('<psound:<p>,a.b,1.2>')
    rerender({ entryKey: 'c.d', pitch: 1.2 })
    expect(result.current.jmhText).toBe('<psound:<p>,c.d,1.2>')
  })

  it('follows the command choice', () => {
    const { result } = renderHook(() => useJmh('a.b', 1, 100))
    act(() => {
      result.current.setCommand('gsound')
    })
    expect(result.current.jmhText).toBe('<gsound:a.b>')
  })

  it('blinks the copy flag for 600ms', () => {
    const { result } = renderHook(() => useJmh('a.b', 1, 100))
    act(() => {
      result.current.copyJmh()
    })
    expect(result.current.jmhCopied).toBe(true)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(result.current.jmhCopied).toBe(false)
  })
})
