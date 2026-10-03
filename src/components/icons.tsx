import type { ReactNode } from 'react'

// Minimal original geometric glyphs, picked deterministically per namespace
// so icons stay stable as the catalog changes across versions.
const NAV_SHAPES: ReactNode[] = [
  <circle key="c" cx="8" cy="8" r="5.5" />,
  <rect key="s" x="3" y="3" width="10" height="10" />,
  <path key="t" d="M8 3 L13.5 13 L2.5 13 Z" />,
  <path key="d" d="M8 2 L14 8 L8 14 L2 8 Z" />,
  <path key="p" d="M8 3 V13 M3 8 H13" />,
  <path key="b" d="M4 12.5 V8 M8 12.5 V3.5 M12 12.5 V6" />,
  <g key="r">
    <circle cx="8" cy="8" r="5.5" />
    <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
  </g>,
  <path key="w" d="M2 8 Q5 4.5 8 8 T14 8" />,
]

export function NamespaceIcon({ namespace }: { namespace: string }) {
  let h = 0
  for (let i = 0; i < namespace.length; i++) h = (h * 31 + namespace.charCodeAt(i)) | 0
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      {NAV_SHAPES[Math.abs(h) % NAV_SHAPES.length]}
    </svg>
  )
}

export function ToggleAllIcon() {
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="8" height="8" />
      <rect x="6.5" y="6.5" width="8" height="8" />
    </svg>
  )
}

export function ClipboardIcon() {
  return (
    <svg
      className="jmhscript-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <rect x="4" y="3" width="8" height="11" rx="1" />
      <rect x="6" y="1.5" width="4" height="3" rx="0.5" />
      <path d="M6.5 8h3M6.5 10.5h3" />
    </svg>
  )
}

export function CheckIcon() {
  return (
    <svg
      className="jmhscript-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
    >
      <path d="M3 8.5 L6.5 12 L13 4.5" />
    </svg>
  )
}
