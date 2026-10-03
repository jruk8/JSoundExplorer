import { describe, expect, it } from 'vitest'
import { sortSoundKeys } from './playcounts.ts'

describe('sortSoundKeys', () => {
  const keys = ['b.two', 'a.one', 'c.three']

  it('keeps catalog order for none', () => {
    expect(sortSoundKeys(keys, { 'a.one': 5 }, 'none')).toBe(keys)
  })

  it('ranks most played first, ties alphabetical', () => {
    expect(sortSoundKeys(keys, { 'a.one': 3, 'b.two': 9, 'c.three': 3 }, 'most')).toEqual([
      'b.two',
      'a.one',
      'c.three',
    ])
  })

  it('ranks least played first with missing counts as zero', () => {
    expect(sortSoundKeys(keys, { 'b.two': 9 }, 'least')).toEqual(['a.one', 'c.three', 'b.two'])
  })
})
