import { describe, expect, it } from 'vitest'
import { keyMatchesQuery, parseCatalog } from './catalog.ts'

describe('keyMatchesQuery', () => {
  it('matches raw key text', () => {
    expect(keyMatchesQuery('mob.lava_chicken.hurt', 'lava_chicken')).toBe(true)
    expect(keyMatchesQuery('block.stone.break', 'block.stone')).toBe(true)
  })

  it('matches the fancy card title', () => {
    expect(keyMatchesQuery('mob.lava_chicken.hurt', 'Lava Chicken')).toBe(true)
    expect(keyMatchesQuery('mob.lava_chicken.hurt', 'lava chicken')).toBe(true)
    expect(keyMatchesQuery('block.stone.break', 'Stone Break')).toBe(true)
  })

  it('matches multi-word queries in any order', () => {
    expect(keyMatchesQuery('mob.villager.death', 'villager mob')).toBe(true)
    expect(keyMatchesQuery('mob.villager.death', 'death villager mob')).toBe(true)
    expect(keyMatchesQuery('mob.villager.death', '  villager   mob  ')).toBe(true)
    expect(keyMatchesQuery('ui.click', 'Click Ui')).toBe(true)
  })

  it('requires every word to match', () => {
    expect(keyMatchesQuery('mob.villager.death', 'villager zombie')).toBe(false)
    expect(keyMatchesQuery('ui.click', 'click ui toast')).toBe(false)
  })

  it('matches everything on an empty query', () => {
    expect(keyMatchesQuery('ui.click', '')).toBe(true)
    expect(keyMatchesQuery('ui.click', '   ')).toBe(true)
  })

  it('rejects non-matches', () => {
    expect(keyMatchesQuery('ui.click', 'zombie')).toBe(false)
    expect(keyMatchesQuery('ui.click', 'click bell')).toBe(false)
  })
})

describe('parseCatalog', () => {
  it('preserves /playsound event ids verbatim', () => {
    const { sounds, version } = parseCatalog({
      version: '26.3',
      generatedAt: '2026-10-08T00:00:00.000Z',
      sounds: {
        'item.bucket.fill_sulfur_cube': [{ hash: 'aa', size: 1 }],
        'item.trident.riptide_1': [{ hash: 'bb', size: 2 }],
        'item.trident.riptide_2': [{ hash: 'cc', size: 3 }],
        'music_disc.11': [{ hash: 'dd', size: 4 }],
      },
    })
    expect(version).toBe('26.3')
    expect(Object.keys(sounds).sort()).toEqual([
      'item.bucket.fill_sulfur_cube',
      'item.trident.riptide_1',
      'item.trident.riptide_2',
      'music_disc.11',
    ])
  })

  it('accepts a bare key-to-variants map', () => {
    const { sounds, version } = parseCatalog({
      'entity.item.pickup': [{ hash: 'aa', size: 1 }],
    })
    expect(version).toBeNull()
    expect(Object.keys(sounds)).toEqual(['entity.item.pickup'])
  })

  it('drops entries without playable variants', () => {
    const { sounds } = parseCatalog({
      version: '26.3',
      sounds: {
        'entity.item.pickup': [{ hash: 'aa', size: 1 }],
        'silent.event': [],
        broken: [{ hash: 'bb' }],
        nonsense: 'nope',
      },
    })
    expect(Object.keys(sounds)).toEqual(['entity.item.pickup'])
  })

  it('rejects non-object catalogs', () => {
    expect(() => parseCatalog(null)).toThrow('Invalid catalog')
    expect(() => parseCatalog(42)).toThrow('Invalid catalog')
  })
})
