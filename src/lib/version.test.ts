import { describe, expect, it } from 'vitest'
import { formatAppVersion } from './version.ts'

describe('formatAppVersion', () => {
  it('shows an exact tag bare on a clean tree', () => {
    expect(formatAppVersion('1.3.0', '1.3.0', false)).toBe('1.3.0')
  })

  it('adds -SNAPSHOT on a dirty tree', () => {
    expect(formatAppVersion('1.3.0', '1.3.0', true)).toBe('1.3.0-SNAPSHOT')
  })

  it('strips a leading v from tags', () => {
    expect(formatAppVersion('v1.2.0', 'v1.2.0', false)).toBe('1.2.0')
    expect(formatAppVersion(null, 'v1.2.0', false)).toBe('1.2.0-SNAPSHOT')
  })

  it('falls back to the last tag off a tagged commit', () => {
    expect(formatAppVersion(null, '1.3.0', false)).toBe('1.3.0-SNAPSHOT')
  })

  it('falls back to 0.0.0-SNAPSHOT with no tags', () => {
    expect(formatAppVersion(null, null, false)).toBe('0.0.0-SNAPSHOT')
    expect(formatAppVersion('', '', true)).toBe('0.0.0-SNAPSHOT')
  })
})
