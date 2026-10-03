import { describe, expect, it } from 'vitest'
import {
  darkenColor,
  easeInQuart,
  pickUiSound,
  pickVaultPitch,
  pickVaultSound,
  vaultSeparation,
  vaultShouldOpen,
} from './interaction.ts'

describe('easeInQuart', () => {
  it('holds loud early, then dives to silence', () => {
    expect(easeInQuart(0)).toBe(0)
    expect(easeInQuart(1)).toBe(1)
    expect(easeInQuart(0.5)).toBeCloseTo(0.0625, 5)
  })
})

describe('darkenColor', () => {
  it('darkens the app background 13% for the vault', () => {
    expect(darkenColor('#1e2129', 0.87)).toBe('#1a1d24')
  })

  it('handles shorthand hex', () => {
    expect(darkenColor('#fff', 0.5)).toBe('#808080')
  })

  it('handles rgb() input', () => {
    expect(darkenColor('rgb(30, 33, 41)', 0.87)).toBe('#1a1d24')
  })

  it('clamps the factor to 0-1', () => {
    expect(darkenColor('#1e2129', 2)).toBe('#1e2129')
    expect(darkenColor('#1e2129', -1)).toBe('#000000')
  })

  it('falls back on unparseable input', () => {
    expect(darkenColor('not-a-color', 0.87)).toBe('#1a1d24')
    expect(darkenColor('#zzz', 0.87)).toBe('#1a1d24')
  })
})

describe('vaultSeparation', () => {
  it('is cubic: half drag moves an eighth', () => {
    expect(vaultSeparation(0, 460)).toBe(0)
    expect(vaultSeparation(120, 460)).toBeCloseTo(57.5, 5)
    expect(vaultSeparation(240, 460)).toBe(460)
  })

  it('clamps outside 0-open range', () => {
    expect(vaultSeparation(-50, 460)).toBe(0)
    expect(vaultSeparation(999, 460)).toBe(460)
  })
})

describe('vaultShouldOpen', () => {
  it('opens on a click', () => {
    expect(vaultShouldOpen(0, 0)).toBe(true)
    expect(vaultShouldOpen(5, 0)).toBe(true)
  })

  it('snaps back on a short slow drag', () => {
    expect(vaultShouldOpen(60, 0)).toBe(false)
  })

  it('opens past the commit fraction', () => {
    expect(vaultShouldOpen(120, 0)).toBe(true)
  })

  it('opens on a fling either way', () => {
    expect(vaultShouldOpen(20, 0.9)).toBe(true)
    expect(vaultShouldOpen(20, -0.9)).toBe(true)
    expect(vaultShouldOpen(20, 0.5)).toBe(false)
  })
})

describe('pickVaultSound', () => {
  it('prefers the named fanfare sounds', () => {
    expect(pickVaultSound(['ui.click', 'random.pop', 'block.x'], () => 0)).toBe('random.pop')
  })

  it('falls back to any catalog key', () => {
    expect(pickVaultSound(['ui.click', 'block.x'], () => 0.75)).toBe('block.x')
  })

  it('returns null for an empty pool', () => {
    expect(pickVaultSound([])).toBeNull()
  })

  it('samples pitch across the vault range', () => {
    expect(pickVaultPitch(() => 0)).toBe(0.9)
    expect(pickVaultPitch(() => 0.5)).toBe(1)
    expect(pickVaultPitch(() => 0.99)).toBe(1.1)
  })
})

describe('pickUiSound', () => {
  it('prefers the exact key when cataloged', () => {
    expect(pickUiSound(['ui.click', 'item.spyglass.stop'], 'item.spyglass.stop', () => 0.99)).toBe(
      'item.spyglass.stop',
    )
  })

  it('falls back to the vault pool', () => {
    expect(pickUiSound(['ui.click', 'random.bow'], 'item.spyglass.stop', () => 0)).toBe(
      'random.bow',
    )
  })

  it('returns null for an empty pool', () => {
    expect(pickUiSound([], 'item.spyglass.stop')).toBeNull()
  })
})
