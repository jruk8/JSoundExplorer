// Build sounds.json from the Mojang version manifest + asset index +
// streamed sound definitions.
// Original implementation: no code or data taken from any prior repo.
//
// Usage:
//   node scripts/build-catalog.mjs [output]
//   node scripts/build-catalog.mjs --output public/sounds.json
//
// Output shape: { version, generatedAt, sounds: { eventId: [{ hash, size }] } }
// Keys are /playsound event ids verbatim (minecraft/sounds.json), each
// listing the distinct .ogg files the event resolves to. Event references
// ({"type": "event"}) are followed transitively; events resolving to zero
// playable files are dropped.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const RESOURCE_BASE = 'https://resources.download.minecraft.net'
const SOUND_PREFIX = 'minecraft/sounds/'
const SOUND_SUFFIX = '.ogg'
const DEFINITIONS_PATH = 'minecraft/sounds.json'

function outputPathFromArgs(argv) {
  const args = argv.slice(2)
  const flagIdx = args.indexOf('--output')
  if (flagIdx !== -1 && args[flagIdx + 1]) return args[flagIdx + 1]
  const eqArg = args.find((a) => a.startsWith('--output='))
  if (eqArg) return eqArg.slice('--output='.length)
  const positional = args.find((a) => !a.startsWith('-'))
  return positional ?? 'public/sounds.json'
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed: ${url} -> HTTP ${res.status}`)
  return res.json()
}

/**
 * File names (sans prefix/suffix) an event resolves to. Event references
 * are followed transitively; the seen set guards reference cycles.
 */
export function resolveEventFiles(eventId, definitions, seen = new Set()) {
  if (seen.has(eventId)) return []
  seen.add(eventId)
  const entry = definitions?.[eventId]
  const sounds = Array.isArray(entry?.sounds) ? entry.sounds : []
  const files = []
  for (const sound of sounds) {
    const ref = typeof sound === 'string' ? { name: sound } : sound
    if (typeof ref?.name !== 'string' || ref.name === '') continue
    const type = typeof ref.type === 'string' ? ref.type : 'sound'
    if (type === 'event') {
      files.push(...resolveEventFiles(ref.name, definitions, seen))
    } else if (type === 'sound') {
      files.push(ref.name)
    }
    // Unknown entry types are skipped: never emit a row we cannot play.
  }
  return files
}

/**
 * Build the event-keyed catalog from asset-index objects and sound
 * definitions. Repeat file listings dedupe by hash; events with no
 * playable file are reported (not emitted) via emptyEvents, and file
 * names missing from the asset index via missingFiles.
 */
export function buildEventCatalog(assetObjects, definitions) {
  /** @type {Map<string, {hash: string, size: number}>} */
  const fileMeta = new Map()
  for (const [assetPath, meta] of Object.entries(assetObjects ?? {})) {
    if (!assetPath.startsWith(SOUND_PREFIX) || !assetPath.endsWith(SOUND_SUFFIX)) continue
    if (typeof meta?.hash !== 'string' || typeof meta?.size !== 'number') continue
    fileMeta.set(assetPath, { hash: meta.hash, size: meta.size })
  }

  /** @type {Record<string, Array<{hash: string, size: number}>>} */
  const sounds = {}
  /** @type {string[]} */
  const emptyEvents = []
  /** @type {string[]} */
  const missingFiles = []
  for (const eventId of Object.keys(definitions ?? {}).sort()) {
    const names = resolveEventFiles(eventId, definitions)
    /** @type {Map<string, {hash: string, size: number}>} */
    const variants = new Map()
    for (const name of names) {
      const meta = fileMeta.get(`${SOUND_PREFIX}${name}${SOUND_SUFFIX}`)
      if (!meta) {
        missingFiles.push(`${eventId} -> ${name}`)
        continue
      }
      variants.set(meta.hash, { hash: meta.hash, size: meta.size })
    }
    const list = [...variants.values()].sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
    if (list.length === 0) {
      emptyEvents.push(eventId)
      continue
    }
    sounds[eventId] = list
  }
  return { sounds, emptyEvents, missingFiles }
}

async function main() {
  const outPath = outputPathFromArgs(process.argv)

  const manifest = await fetchJson(VERSION_MANIFEST_URL)
  const latestRelease = manifest?.latest?.release
  if (!latestRelease) throw new Error('Version manifest has no latest.release')
  const entry = (manifest.versions ?? []).find((v) => v.id === latestRelease)
  if (!entry?.url) throw new Error(`No manifest entry for release ${latestRelease}`)

  const versionData = await fetchJson(entry.url)
  const assetIndexUrl = versionData?.assetIndex?.url
  if (!assetIndexUrl) throw new Error(`Version ${latestRelease} has no assetIndex.url`)

  const assetIndex = await fetchJson(assetIndexUrl)
  const objects = assetIndex?.objects ?? {}

  const definitionsMeta = objects[DEFINITIONS_PATH]
  if (typeof definitionsMeta?.hash !== 'string') {
    throw new Error('Asset index has no minecraft/sounds.json')
  }
  const definitions = await fetchJson(
    `${RESOURCE_BASE}/${definitionsMeta.hash.slice(0, 2)}/${definitionsMeta.hash}`,
  )

  const { sounds, emptyEvents, missingFiles } = buildEventCatalog(objects, definitions)

  const output = {
    version: latestRelease,
    generatedAt: new Date().toISOString(),
    sounds,
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(output) + '\n')
  console.log(
    `Wrote ${outPath}: version=${latestRelease} events=${Object.keys(sounds).length} ` +
      `empty=${emptyEvents.length} missing=${missingFiles.length}`,
  )
  for (const eventId of emptyEvents) console.warn(`Empty event (dropped): ${eventId}`)
  for (const ref of missingFiles) console.warn(`Missing file: ${ref}`)
}

const invokedAsScript = process.argv[1] === fileURLToPath(import.meta.url)
if (invokedAsScript) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
