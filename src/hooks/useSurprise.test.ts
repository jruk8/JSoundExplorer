// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSurprise } from './useSurprise.ts'

describe('useSurprise fade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('schedules a sting fade landing on the auto-click', async () => {
    const onPick = vi.fn()
    const fadeOutCurrent = vi.fn()
    const { result } = renderHook(() =>
      useSurprise({ keys: ['a.b'], setPitch: vi.fn(), onPick, fadeOutCurrent }),
    )
    await act(async () => {
      result.current.spotlight('a.b', 1)
    })
    expect(fadeOutCurrent).toHaveBeenCalledWith(510)
    // No row in jsdom: nothing to scroll, so the pick fires immediately.
    expect(onPick).toHaveBeenCalledWith('a.b', 1)
  })
})
