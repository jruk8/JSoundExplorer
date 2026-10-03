import { useEffect, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { CATALOG_URL, MOCK_SOUNDS, parseCatalog } from '../lib/catalog.ts'

export interface CatalogState {
  catalog: SoundCatalog | null
  version: string | null
  offline: boolean
  loading: boolean
}

/** Fetch the sound catalog, falling back to offline mock data. */
export function useCatalog(): CatalogState {
  const [catalog, setCatalog] = useState<SoundCatalog | null>(null)
  const [version, setVersion] = useState<string | null>(null)
  const [offline, setOffline] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(CATALOG_URL)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json: unknown = await res.json()
        const { sounds, version: v } = parseCatalog(json)
        if (cancelled) return
        setCatalog(sounds)
        setVersion(v)
        setOffline(false)
      } catch {
        if (cancelled) return
        setCatalog({ ...MOCK_SOUNDS })
        setVersion(null)
        setOffline(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return { catalog, version, offline, loading }
}
