// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { usePlayback } from './usePlayback.ts'

describe('usePlayback', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function setup() {
    const onPlay = vi.fn()
    const catalog = { 'a.b': [{ hash: '00', size: 1 }] }
    const hook = renderHook(() =>
      usePlayback({
        catalog,
        offline: false,
        pitch: 1,
        volume: 100,
        resolveMember: (k) => k,
        onPlay,
      }),
    )
    return { ...hook, onPlay }
  }

  it('logs normal plays to history', () => {
    const { result, onPlay } = setup()
    act(() => {
      result.current.play('a.b')
    })
    expect(onPlay).toHaveBeenCalledWith({ key: 'a.b', pitch: 1, volume: 100 })
    expect(result.current.playingKey).toBe('a.b')
  })

  it('skips history for internal sounds', () => {
    const { result, onPlay } = setup()
    act(() => {
      result.current.play('a.b', { pitch: 1.1, volume: 100, internal: true })
    })
    expect(onPlay).not.toHaveBeenCalled()
    expect(result.current.playingKey).toBe('a.b')
  })

  it('stops the current sound', () => {
    const { result } = setup()
    act(() => {
      result.current.play('a.b')
    })
    act(() => {
      result.current.stop()
    })
    expect(result.current.playingKey).toBeNull()
  })

  it('marks internal sounds so list filters never stop them', () => {
    const { result } = setup()
    act(() => {
      result.current.play('a.b', { internal: true })
    })
    expect(result.current.isInternalPlaying()).toBe(true)
    act(() => {
      result.current.play('a.b')
    })
    expect(result.current.isInternalPlaying()).toBe(false)
  })

  it('clears the internal mark on stop', () => {
    const { result } = setup()
    act(() => {
      result.current.play('a.b', { internal: true })
    })
    act(() => {
      result.current.stop()
    })
    expect(result.current.isInternalPlaying()).toBe(false)
  })

  it('fades a marked UI sound to silence on schedule', () => {
    vi.useFakeTimers()
    const volumeSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'volume', 'set')
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
    const { result } = setup()
    act(() => {
      result.current.play('a.b', { internal: true, fade: true, volume: 50 })
    })
    act(() => {
      result.current.fadeOutCurrent(225)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    const sets = volumeSpy.mock.calls.map((c) => c[0])
    expect(sets[0]).toBe(0.5)
    expect(sets[sets.length - 1]).toBe(0)
    // Quartic hold-then-dive: loud past the midpoint, nearly gone at the end.
    expect(sets[7]).toBeGreaterThan(0.45)
    expect(sets[sets.length - 2]).toBeLessThan(0.05)
    for (let i = 1; i < sets.length; i++) expect(sets[i]).toBeLessThanOrEqual(sets[i - 1])
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(result.current.playingKey).toBeNull()
  })

  it('leaves card sounds untouched by fadeOutCurrent', () => {
    vi.useFakeTimers()
    const volumeSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'volume', 'set')
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
    const { result } = setup()
    act(() => {
      result.current.play('a.b')
    })
    act(() => {
      result.current.fadeOutCurrent(225)
    })
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(volumeSpy.mock.calls.map((c) => c[0])).toEqual([1])
    expect(pauseSpy).not.toHaveBeenCalled()
    expect(result.current.playingKey).toBe('a.b')
  })

  it('crossfades a UI sting under an interrupting sound', () => {
    vi.useFakeTimers()
    const volumeSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'volume', 'set')
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
    const { result } = setup()
    act(() => {
      result.current.play('a.b', { internal: true, fade: true, volume: 50 })
    })
    act(() => {
      result.current.play('a.b')
    })
    expect(result.current.playingKey).toBe('a.b')
    act(() => {
      vi.advanceTimersByTime(200)
    })
    const sets = volumeSpy.mock.calls.map((c) => c[0])
    expect(sets[0]).toBe(0.5)
    expect(sets[1]).toBe(1)
    expect(sets[sets.length - 1]).toBe(0)
    expect(pauseSpy).toHaveBeenCalledTimes(1)
    expect(result.current.playingKey).toBe('a.b')
  })
})
