// Persisted user preferences (namespace toggles). localStorage only;
// no React dependency.

export const NAMESPACE_PREFS_KEY = 'jsoundexplorer.namespaceToggles.v1'

/** Namespaces that start disabled. The list itself stays dynamic (derived */
/** from the catalog); only this default-off rule is hardcoded. */
export const DEFAULT_OFF_NAMESPACES: ReadonlySet<string> = new Set(['ambient'])

export function loadNamespacePrefs(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(NAMESPACE_PREFS_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const prefs: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'boolean') prefs[key] = value
    }
    return prefs
  } catch {
    return {}
  }
}

export function saveNamespacePrefs(prefs: Record<string, boolean>): void {
  try {
    localStorage.setItem(NAMESPACE_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    // Storage unavailable (private mode etc.): run unpersisted.
  }
}
