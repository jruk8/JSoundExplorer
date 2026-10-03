import { en } from '../locales/en.ts'
import { NamespaceIcon, StopIcon, ToggleAllIcon } from './icons.tsx'

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
  swipeDisabled: boolean
  onSwipe: () => void
  classicalDisabled: boolean
  classicalPlaying: boolean
  onClassical: () => void
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
  swipeDisabled,
  onSwipe,
  classicalDisabled,
  classicalPlaying,
  onClassical,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <nav className="navbar" aria-label={en.sidebar.navLabel}>
        <button
          type="button"
          data-testid="toggle-all"
          className="nav-toggle-all"
          aria-pressed={allOn}
          onClick={onToggleAll}
        >
          <ToggleAllIcon />
          {allOn ? en.sidebar.turnAllOff : en.sidebar.turnAllOn}
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
          {en.sidebar.surprise}
        </button>
        <button
          type="button"
          data-testid="swipe"
          className="swipe-btn"
          disabled={swipeDisabled}
          onClick={onSwipe}
        >
          {en.sidebar.swipe}
        </button>
        <label className="surprise-pitch-label">
          <input
            type="checkbox"
            data-testid="surprise-pitch"
            className="nav-checkbox"
            checked={surprisePitch}
            onChange={(e) => onSurprisePitchChange(e.target.checked)}
          />
          {en.sidebar.alsoPitch}
        </label>
        <button
          type="button"
          data-testid="classical"
          className={classicalPlaying ? 'classical-btn playing' : 'classical-btn'}
          disabled={classicalDisabled}
          onClick={onClassical}
          aria-label={classicalPlaying ? en.sidebar.classicalStop : en.sidebar.classical}
        >
          {classicalPlaying ? <StopIcon className="classical-stop-icon" /> : en.sidebar.classical}
        </button>
      </div>
    </div>
  )
}
