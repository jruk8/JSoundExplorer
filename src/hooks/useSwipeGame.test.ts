// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SwipeCardData, SwipeGameOptions } from './useSwipeGame.ts'
import { shuffleRunoff, useSwipeGame } from './useSwipeGame.ts'

const card = (key: string): SwipeCardData => ({ key, pitch: 1 })

describe('shuffleRunoff', () => {
  it('never opens with the previous rounds last card', () => {
    const picks = [card('a'), card('b'), card('c')]
    for (let i = 0; i < 200; i++) {
      expect(shuffleRunoff(picks, 'c')[0].key).not.toBe('c')
    }
  })

  it('keeps every picked card', () => {
    const picks = [card('a'), card('b'), card('c')]
    const next = shuffleRunoff(picks, 'c')
    expect(next.map((c) => c.key).sort()).toEqual(['a', 'b', 'c'])
  })

  it('leaves single-card runoffs alone', () => {
    expect(shuffleRunoff([card('a')], 'a')).toEqual([card('a')])
  })
})

describe('useSwipeGame sounds', () => {
  // Visible deck: no UI sounds cataloged here, so every UI pick must come
  // from the unfiltered pool (no category gates internal sounds).
  const KEYS = ['a.b', 'c.d', 'e.f', 'g.h', 'i.j', 'k.l']
  const POOL = [
    ...KEYS,
    'random.pop',
    'random.glass',
    'random.click',
    'random.door_open',
    'random.bow',
    'step.snow',
    'block.copper_chest.copper_chest_open',
  ]

  function setup(overrides: Partial<SwipeGameOptions> = {}) {
    const play = vi.fn()
    const recordPlay = vi.fn()
    const spotlight = vi.fn()
    const props: SwipeGameOptions = {
      keys: KEYS,
      soundPool: POOL,
      volume: 80,
      pitch: 1,
      randomizePitch: false,
      recordPlay,
      playingKey: null,
      play,
      stop: vi.fn(),
      spotlight,
      ...overrides,
    }
    const hook = renderHook((p: SwipeGameOptions) => useSwipeGame(p), { initialProps: props })
    return { ...hook, play, recordPlay, spotlight }
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('stings on open, as the overlay starts darkening', () => {
    const { result, play } = setup()
    act(() => {
      result.current.open()
    })
    expect(play).toHaveBeenCalledTimes(1)
    const [key, opts] = play.mock.calls[0]
    expect(['random.pop', 'random.glass', 'random.click', 'random.door_open', 'random.bow']).toContain(
      key,
    )
    expect(opts).toMatchObject({ volume: 40, internal: true, fade: true })
    expect([0.9, 1, 1.1]).toContain(opts?.pitch)
  })

  it('stings again on each runoff round', () => {
    const { result, play } = setup()
    act(() => {
      result.current.open()
    })
    for (let i = 0; i < 6; i++) {
      act(() => {
        result.current.exitThrow(i < 2 ? 'right' : 'left')
      })
    }
    expect(result.current.roundNo).toBe(2)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('plays step.snow strictly on left commit', () => {
    const { result, play, recordPlay } = setup()
    act(() => {
      result.current.open()
    })
    act(() => {
      result.current.commitThrow('left')
    })
    const snow = play.mock.calls.find(([k]) => k === 'step.snow')
    expect(snow?.[1]).toMatchObject({ volume: 40, internal: true, fade: true })
    expect([0.9, 1, 1.1]).toContain(snow?.[1]?.pitch)
    expect(recordPlay).not.toHaveBeenCalled()
  })

  it('replays the card with boost and fade on right commit', () => {
    const { result, play, recordPlay } = setup()
    act(() => {
      result.current.open()
    })
    const key = result.current.current?.key
    act(() => {
      result.current.commitThrow('right')
    })
    const replay = play.mock.calls.find(([k]) => k === key)
    expect(replay?.[1]?.volume).toBeCloseTo(92, 5)
    expect(replay?.[1]).toMatchObject({ fade: true })
    expect(recordPlay).toHaveBeenCalledWith(key)
  })

  it('stays silent on discard when step.snow is not cataloged', () => {
    const { result, play } = setup({ soundPool: ['a.b', 'random.pop'] })
    act(() => {
      result.current.open()
    })
    act(() => {
      result.current.commitThrow('left')
    })
    // Open sting only; the missing discard stings nothing.
    expect(play).toHaveBeenCalledTimes(1)
    expect(play.mock.calls.find(([k]) => k === 'step.snow')).toBeUndefined()
  })

  it('fans out the winner sound at half volume on close with a winner', () => {
    const { result, play, spotlight } = setup()
    act(() => {
      result.current.open()
    })
    for (let i = 0; i < 6; i++) {
      act(() => {
        result.current.exitThrow(i === 0 ? 'right' : 'left')
      })
    }
    const chest = play.mock.calls.find(([k]) => k === 'block.copper_chest.copper_chest_open')
    expect(chest?.[1]).toMatchObject({ pitch: 1.1, volume: 40, internal: true, fade: true })
    act(() => {
      vi.advanceTimersByTime(450)
    })
    expect(spotlight).toHaveBeenCalledTimes(1)
  })

  it('reports round counts', () => {
    const { result } = setup()
    act(() => {
      result.current.open()
    })
    expect(result.current.roundNo).toBe(1)
    expect(result.current.cardsLeft).toBe(6)
    act(() => {
      result.current.exitThrow('right')
    })
    expect(result.current.cardsLeft).toBe(5)
    expect(result.current.pickedCount).toBe(1)
    expect(result.current.discarded).toBe(0)
    act(() => {
      result.current.exitThrow('left')
    })
    expect(result.current.cardsLeft).toBe(4)
    expect(result.current.discarded).toBe(1)
  })
})
