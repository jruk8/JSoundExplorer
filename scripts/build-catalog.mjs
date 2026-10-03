// Build sounds.json from the Mojang version manifest + asset index.
// Original implementation: no code or data taken from any prior repo.
//
// Usage:
//   node scripts/build-catalog.mjs [output]
//   node scripts/build-catalog.mjs --output public/sounds.json
//
// Output shape: { version, generatedAt, sounds: { key: [{ hash, size }] } }

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const SOUND_PREFIX = 'minecraft/sounds/'
const SOUND_SUFFIX = '.ogg'

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

function soundKeyForAssetPath(assetPath) {
  return assetPath.slice(SOUND_PREFIX.length, -SOUND_SUFFIX.length).replaceAll('/', '.')
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

  /** @type {Record<string, Array<{hash: string, size: number}>>} */
  const sounds = {}
  for (const [assetPath, meta] of Object.entries(objects)) {
    if (!assetPath.startsWith(SOUND_PREFIX) || !assetPath.endsWith(SOUND_SUFFIX)) continue
    if (typeof meta?.hash !== 'string' || typeof meta?.size !== 'number') continue
    const key = soundKeyForAssetPath(assetPath)
    ;(sounds[key] ??= []).push({ hash: meta.hash, size: meta.size })
  }
  for (const variants of Object.values(sounds)) {
    variants.sort((a, b) => (a.hash < b.hash ? -1 : a.hash > b.hash ? 1 : 0))
  }

  const output = {
    version: latestRelease,
    generatedAt: new Date().toISOString(),
    sounds,
  }

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(output) + '\n')
  console.log(
    `Wrote ${outPath}: version=${latestRelease} keys=${Object.keys(sounds).length}`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
