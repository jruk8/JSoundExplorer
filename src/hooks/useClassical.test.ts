// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useClassical } from './useClassical.ts'

const { playedUrls } = vi.hoisted(() => ({ playedUrls: [] as string[] }))

vi.mock('../lib/playback.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../lib/playback.ts')>()
  return {
    ...mod,
    playRemoteUrl: (
      url: string,
      pitch: number,
      volumePercent: number,
      onFailed?: () => void,
    ) => {
      playedUrls.push(url)
      return mod.playRemoteUrl(url, pitch, volumePercent, onFailed)
    },
  }
})

// Two-note piece at division 96, 120bpm: C4 at 0ms, D4 at 500ms,
// each 500ms long.
const PIECE = new Uint8Array([
  0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
  0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 27,
  0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
  0x00, 0x90, 0x3c, 0x40,
  0x60, 0x90, 0x3e, 0x50,
  0x60, 0x80, 0x3c, 0x40,
  0x00, 0x80, 0x3e, 0x40,
  0x00, 0xff, 0x2f, 0x00,
])

describe('useClassical', () => {
  beforeEach(() => {
    playedUrls.length = 0
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => PIECE.buffer }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function setup(soundKey: string | null = 'a.b') {
    const stopPlayback = vi.fn()
    const hook = renderHook(
      (props: { pitch: number; volume: number; soundKey: string | null }) =>
        useClassical({
          soundKey: props.soundKey,
          pitch: props.pitch,
          volume: props.volume,
          catalog: {
            'a.b': [{ hash: 'aa01', size: 1 }],
            'c.d': [{ hash: 'cc02', size: 1 }],
          },
          resolveMember: (k) => k,
          stopPlayback,
        }),
      { initialProps: { pitch: 1, volume: 100, soundKey } },
    )
    const rateSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'playbackRate', 'set')
    const volumeSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'volume', 'set')
    const pauseSpy = vi.spyOn(window.HTMLMediaElement.prototype, 'pause')
    const playMock = window.HTMLMediaElement.prototype.play as unknown as ReturnType<typeof vi.fn>
    return { ...hook, stopPlayback, rateSpy, volumeSpy, pauseSpy, playMock }
  }

  async function start(result: { current: { toggle: () => void } }) {
    await act(async () => {
      result.current.toggle()
    })
  }

  it('lets repeated notes overlap instead of cutting', async () => {
    vi.useFakeTimers()
    // C4 at 0ms and again at 250ms, each 500ms long.
    const overlap = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0, 96,
      0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, 27,
      0x00, 0xff, 0x51, 0x03, 0x07, 0xa1, 0x20,
      0x00, 0x90, 0x3c, 0x40,
      0x30, 0x90, 0x3c, 0x50,
      0x30, 0x80, 0x3c, 0x40,
      0x30, 0x80, 0x3c, 0x40,
      0x00, 0xff, 0x2f, 0x00,
    ])
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => overlap.buffer,
    } as unknown as Response)
    const { result, pauseSpy, playMock } = setup()
    await start(result)
    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(playMock).toHaveBeenCalledTimes(2)
    expect(pauseSpy).not.toHaveBeenCalled()
    expect(result.current.playing).toBe(true)
  })

  it('releases notes with a fade tail instead of cutting', async () => {
    vi.useFakeTimers()
    const { result, pauseSpy, volumeSpy, playMock } = setup()
    await start(result)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(playMock).toHaveBeenCalledTimes(2)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    // Both note-offs land at 1000ms: nothing pauses yet, the tail rings.
    expect(pauseSpy).not.toHaveBeenCalled()
    expect(result.current.playing).toBe(true)
    act(() => {
      vi.advanceTimersByTime(150)
    })
    // Tails complete: volumes ramped to silence, then paused, then done.
    expect(pauseSpy).toHaveBeenCalledTimes(2)
    const sets = volumeSpy.mock.calls.map((c) => c[0])
    expect(sets.length).toBe(2 + 2 * 5)
    expect(sets[sets.length - 1]).toBe(0)
    expect(Math.min(...sets)).toBe(0)
    expect(result.current.playing).toBe(false)
  })

  it('performs every note on the given sound', async () => {
    vi.useFakeTimers()
    const { result } = setup('c.d')
    await start(result)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    expect(playedUrls.length).toBe(2)
    expect(new Set(playedUrls).size).toBe(1)
    expect(playedUrls[0]).toContain('cc02')
    expect(result.current.playing).toBe(true)
  })

  it('anchors notes to the detected sample pitch', async () => {
    vi.useFakeTimers()
    // A second of A4: the anchor moves from 60 to 69.
    const sr = 44100
    const data = new Float32Array(sr)
    for (let i = 0; i < sr; i++) data[i] = Math.sin((2 * Math.PI * 440 * i) / sr) * 0.8
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running'
        async resume() {}
        async decodeAudioData() {
          return { sampleRate: sr, getChannelData: () => data }
        }
      },
    )
    const { result, rateSpy } = setup()
    await start(result)
    expect(result.current.playing).toBe(true)
    // C4 against an A4 sample: shifted down a minor sixth.
    expect(rateSpy.mock.calls[0][0]).toBeCloseTo(Math.pow(2, -9 / 12), 5)
    const urls = vi.mocked(fetch).mock.calls.map(([u]) => String(u))
    expect(urls.some((u) => u.includes('/api/sample?hash=aa01'))).toBe(true)
  })

  it('falls back to middle C when analysis fails', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running'
        async resume() {}
        async decodeAudioData(): Promise<AudioBuffer> {
          throw new Error('nope')
        }
      },
    )
    const { result, rateSpy } = setup()
    await start(result)
    expect(result.current.playing).toBe(true)
    expect(rateSpy.mock.calls[0][0]).toBeCloseTo(1, 5)
  })

  it('performs the piece at mapped pitches', async () => {
    vi.useFakeTimers()
    const { result, stopPlayback, rateSpy, playMock } = setup()
    await start(result)
    expect(result.current.playing).toBe(true)
    expect(stopPlayback).toHaveBeenCalledTimes(1)
    // C4 fires on the opening tick.
    expect(playMock).toHaveBeenCalledTimes(1)
    expect(rateSpy.mock.calls[0][0]).toBeCloseTo(1, 5)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    // D4 (two semitones up) joins at 500ms while C4 still rings.
    expect(playMock).toHaveBeenCalledTimes(2)
    expect(rateSpy.mock.calls[1][0]).toBeCloseTo(Math.pow(2, 2 / 12), 5)
    act(() => {
      vi.advanceTimersByTime(600)
    })
    // Last note-off drains the actives: the performance ends itself.
    expect(result.current.playing).toBe(false)
  })

  it('retunes ringing notes with the sliders', async () => {
    vi.useFakeTimers()
    const { result, rerender, rateSpy, volumeSpy, playMock } = setup()
    await start(result)
    expect(playMock).toHaveBeenCalledTimes(1)
    rerender({ pitch: 1.5, volume: 50, soundKey: 'a.b' })
    expect(rateSpy.mock.calls[rateSpy.mock.calls.length - 1][0]).toBeCloseTo(1.5, 5)
    // Velocity 64 of 127 at half volume.
    expect(volumeSpy.mock.calls[volumeSpy.mock.calls.length - 1][0]).toBeCloseTo(
      (50 * 64) / 127 / 100,
      5,
    )
  })

  it('switches to a newly picked sound mid-performance', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'AudioContext',
      class {
        state = 'running'
        async resume() {}
        async decodeAudioData() {
          return { sampleRate: 44100, getChannelData: () => new Float32Array(44100) }
        }
      },
    )
    const { result, rerender } = setup('a.b')
    await start(result)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(playedUrls.length).toBe(1)
    expect(playedUrls[0]).toContain('aa01')
    rerender({ pitch: 1, volume: 100, soundKey: 'c.d' })
    act(() => {
      vi.advanceTimersByTime(300)
    })
    // D4 fires at 500ms on the new sound; the run never stops, and the
    // anchor re-detects for the new sample (silence keeps the old one).
    expect(playedUrls.length).toBe(2)
    expect(playedUrls[1]).toContain('cc02')
    expect(result.current.playing).toBe(true)
    const urls = vi.mocked(fetch).mock.calls.map(([u]) => String(u))
    expect(urls.some((u) => u.includes('/api/sample?hash=cc02'))).toBe(true)
  })

  it('stops and silences on toggle', async () => {
    vi.useFakeTimers()
    const { result, pauseSpy, playMock } = setup()
    await start(result)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    act(() => {
      result.current.toggle()
    })
    expect(result.current.playing).toBe(false)
    expect(pauseSpy).toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(playMock).toHaveBeenCalledTimes(1)
  })

  it('stops on Escape', async () => {
    vi.useFakeTimers()
    const { result } = setup()
    await start(result)
    expect(result.current.playing).toBe(true)
    await act(async () => {
      window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }))
    })
    expect(result.current.playing).toBe(false)
  })

  it('does nothing without a selection', async () => {
    vi.useFakeTimers()
    const { result } = setup(null)
    await start(result)
    expect(result.current.playing).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reverts when the piece cannot load', async () => {
    vi.useFakeTimers()
    vi.mocked(fetch).mockRejectedValueOnce(new Error('nope'))
    const { result } = setup()
    await start(result)
    expect(result.current.playing).toBe(false)
  })
})
