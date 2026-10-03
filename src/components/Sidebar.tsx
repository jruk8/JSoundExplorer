import { NamespaceIcon, ToggleAllIcon } from './icons.tsx'

export interface SidebarProps {
  namespaces: string[]
  counts: Map<string, number>
  isEnabled: (ns: string) => boolean
  allOn: boolean
  onToggleAll: () => void
  onToggleNamespace: (ns: string) => void
  surpriseDisabled: boolean
  onSurprise: () => void
  surprisePitch: boolean
  onSurprisePitchChange: (checked: boolean) => void
}

export function Sidebar({
  namespaces,
  counts,
  isEnabled,
  allOn,
  onToggleAll,
  onToggleNamespace,
  surpriseDisabled,
  onSurprise,
  surprisePitch,
  onSurprisePitchChange,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <nav className="navbar" aria-label="Sound namespaces">
        <button
          type="button"
          data-testid="toggle-all"
          className="nav-toggle-all"
          aria-pressed={allOn}
          onClick={onToggleAll}
        >
          <ToggleAllIcon />
          {allOn ? 'Turn all off' : 'Turn all on'}
        </button>
        <hr className="nav-separator" />
        <ul data-testid="namespace-list" className="nav-list">
          {namespaces.map((ns) => (
            <li key={ns} className="nav-item">
              <label>
                <input
                  type="checkbox"
                  data-testid={`ns-toggle-${ns}`}
                  className="nav-checkbox"
                  checked={isEnabled(ns)}
                  onChange={() => onToggleNamespace(ns)}
                />
                <NamespaceIcon namespace={ns} />
                <span className="nav-name">{ns}</span>
                <span className="nav-count">{counts.get(ns)}</span>
              </label>
            </li>
          ))}
        </ul>
      </nav>

      <div className="surprise-zone">
        <hr className="nav-separator" />
        <button
          type="button"
          data-testid="surprise"
          className="surprise-btn"
          disabled={surpriseDisabled}
          onClick={onSurprise}
        >
          Surprise me!
        </button>
        <label className="surprise-pitch-label">
          <input
            type="checkbox"
            data-testid="surprise-pitch"
            className="nav-checkbox"
            checked={surprisePitch}
            onChange={(e) => onSurprisePitchChange(e.target.checked)}
          />
          also pitch
        </label>
      </div>
    </div>
  )
}
