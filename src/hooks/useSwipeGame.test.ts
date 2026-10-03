import { describe, expect, it } from 'vitest'
import type { SwipeCardData } from './useSwipeGame.ts'
import { shuffleRunoff } from './useSwipeGame.ts'

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
