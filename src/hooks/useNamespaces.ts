import { useEffect, useMemo, useState } from 'react'
import type { SoundCatalog } from '../lib/catalog.ts'
import { namespaceOf } from '../lib/catalog.ts'
import {
  DEFAULT_OFF_NAMESPACES,
  loadNamespacePrefs,
  saveNamespacePrefs,
} from '../lib/preferences.ts'

/** Namespace toggles: dynamic list from the catalog, persisted choices. */
export function useNamespaces(catalog: SoundCatalog | null) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(loadNamespacePrefs)

  useEffect(() => {
    saveNamespacePrefs(prefs)
  }, [prefs])

  const { namespaces, counts } = useMemo(() => {
    const counts = new Map<string, number>()
    if (catalog) {
      for (const key of Object.keys(catalog)) {
        const ns = namespaceOf(key)
        counts.set(ns, (counts.get(ns) ?? 0) + 1)
      }
    }
    return { namespaces: [...counts.keys()].sort(), counts }
  }, [catalog])

  function isEnabled(ns: string): boolean {
    return prefs[ns] ?? !DEFAULT_OFF_NAMESPACES.has(ns)
  }

  const allOn = namespaces.every(isEnabled)

  function toggleAll() {
    const next = !allOn
    setPrefs(Object.fromEntries(namespaces.map((ns) => [ns, next])))
  }

  function toggleNamespace(ns: string) {
    setPrefs((prev) => ({ ...prev, [ns]: !(prev[ns] ?? !DEFAULT_OFF_NAMESPACES.has(ns)) }))
  }

  return { namespaces, counts, prefs, isEnabled, allOn, toggleAll, toggleNamespace }
}
