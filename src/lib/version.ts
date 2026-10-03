// Build version domain: derive the display version from git tag state.
// Pure formatting; the git shell-outs live in vite.config.ts.

/** Normalize a tag for display (leading v stripped: v1.2.0 -> 1.2.0). */
function baseOf(tag: string): string {
  return tag.trim().replace(/^v/, '')
}

/**
 * Display version from git state. An exact tag on a clean tree shows bare;
 * a dirty tree or any other commit gets -SNAPSHOT on the last tag (0.0.0
 * when the repo has no tags at all).
 */
export function formatAppVersion(
  exactTag: string | null,
  lastTag: string | null,
  dirty: boolean,
): string {
  if (exactTag !== null && exactTag.trim() !== '') {
    const base = baseOf(exactTag)
    return dirty ? `${base}-SNAPSHOT` : base
  }
  if (lastTag !== null && lastTag.trim() !== '') {
    return `${baseOf(lastTag)}-SNAPSHOT`
  }
  return '0.0.0-SNAPSHOT'
}
