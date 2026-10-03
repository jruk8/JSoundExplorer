import { describe, expect, it } from 'vitest'
import { keyMatchesQuery } from './catalog.ts'

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
