import { describe, expect, it } from 'vitest'
import { en, formatString } from './en.ts'

describe('formatString', () => {
  it('fills named placeholders', () => {
    expect(formatString('Round {n}', { n: 2 })).toBe('Round 2')
    expect(formatString('{value}x', { value: '1.2' })).toBe('1.2x')
  })

  it('renders unknown names empty', () => {
    expect(formatString('a{b}c', {})).toBe('ac')
  })

  it('leaves plain text untouched', () => {
    expect(formatString('Swipe!', {})).toBe('Swipe!')
  })
})

function leaves(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(leaves)
  }
  return []
}

describe('en locale', () => {
  it('has no empty strings', () => {
    const all = leaves(en)
    expect(all.length).toBeGreaterThan(0)
    for (const s of all) expect(s.length).toBeGreaterThan(0)
  })
})
