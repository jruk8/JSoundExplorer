import { describe, expect, it } from 'vitest'
import { buildEventCatalog, resolveEventFiles } from './build-catalog.mjs'

// Tiny Mojang-shaped fixtures: asset-index objects plus sound definitions.
const ASSET_OBJECTS = {
  'minecraft/sounds/item/bucket/fillsulfurcube1.ogg': { hash: 'b2', size: 20 },
  'minecraft/sounds/item/bucket/fillsulfurcube2.ogg': { hash: 'b1', size: 10 },
  'minecraft/sounds/random/pop.ogg': { hash: 'a1', size: 5 },
  'minecraft/sounds.json': { hash: 'zz', size: 1 },
}

const DEFINITIONS = {
  'item.bucket.fill_sulfur_cube': {
    sounds: ['item/bucket/fillsulfurcube1', { name: 'item/bucket/fillsulfurcube2' }],
  },
  'entity.item.pickup': {
    sounds: [{ name: 'random/pop' }, { name: 'item.bucket.fill_sulfur_cube', type: 'event' }],
  },
  'silent.event': { sounds: [] },
  'broken.event': { sounds: [{ name: 'nope/missing' }] },
  'loop.a': { sounds: [{ name: 'loop.b', type: 'event' }] },
  'loop.b': { sounds: [{ name: 'loop.a', type: 'event' }] },
}

describe('resolveEventFiles', () => {
  it('collects file names across string and object entries', () => {
    expect(resolveEventFiles('item.bucket.fill_sulfur_cube', DEFINITIONS).sort()).toEqual([
      'item/bucket/fillsulfurcube1',
      'item/bucket/fillsulfurcube2',
    ])
  })

  it('follows event references transitively', () => {
    expect(resolveEventFiles('entity.item.pickup', DEFINITIONS).sort()).toEqual([
      'item/bucket/fillsulfurcube1',
      'item/bucket/fillsulfurcube2',
      'random/pop',
    ])
  })

  it('terminates on reference cycles', () => {
    expect(resolveEventFiles('loop.a', DEFINITIONS)).toEqual([])
  })

  it('returns no files for unknown events', () => {
    expect(resolveEventFiles('no.such.event', DEFINITIONS)).toEqual([])
  })
})

describe('buildEventCatalog', () => {
  it('keys rows by /playsound event id, not file base', () => {
    const { sounds } = buildEventCatalog(ASSET_OBJECTS, DEFINITIONS)
    expect(Object.keys(sounds).sort()).toEqual([
      'entity.item.pickup',
      'item.bucket.fill_sulfur_cube',
    ])
    expect(sounds['item.bucket.fill_sulfur_cube']).toEqual([
      { hash: 'b1', size: 10 },
      { hash: 'b2', size: 20 },
    ])
  })

  it('resolves transitive event references into the file list', () => {
    const { sounds } = buildEventCatalog(ASSET_OBJECTS, DEFINITIONS)
    expect(sounds['entity.item.pickup']).toEqual([
      { hash: 'a1', size: 5 },
      { hash: 'b1', size: 10 },
      { hash: 'b2', size: 20 },
    ])
  })

  it('drops unplayable events and reports them', () => {
    const { emptyEvents, missingFiles } = buildEventCatalog(ASSET_OBJECTS, DEFINITIONS)
    expect(emptyEvents.sort()).toEqual(['broken.event', 'loop.a', 'loop.b', 'silent.event'])
    expect(missingFiles).toEqual(['broken.event -> nope/missing'])
  })
})
