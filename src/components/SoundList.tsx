export interface SoundListProps {
  loading: boolean
  keys: string[]
  playingKey: string | null
  copiedKey: string | null
  copiedBlue: boolean
  onSoundClick: (key: string) => void
}

export function SoundList({
  loading,
  keys,
  playingKey,
  copiedKey,
  copiedBlue,
  onSoundClick,
}: SoundListProps) {
  if (loading) {
    return (
      <main className="list-wrap">
        <p className="muted">Loading sounds…</p>
      </main>
    )
  }
  if (keys.length === 0) {
    return (
      <main className="list-wrap">
        <p className="muted">No sounds match.</p>
      </main>
    )
  }
  return (
    <main className="list-wrap">
      <ul data-testid="sound-list" className="sound-list">
        {keys.map((key) => (
          <li key={key} className="sound-row-wrap">
            <button
              type="button"
              className={playingKey === key ? 'sound-row playing' : 'sound-row'}
              data-testid={`sound-${key}`}
              data-key={key}
              data-playing={playingKey === key ? 'true' : undefined}
              onClick={() => onSoundClick(key)}
            >
              <span className="sound-key">{key}</span>
              {copiedKey === key && (
                <span
                  data-testid="copied-label"
                  data-phase={copiedBlue ? 'blue' : 'gray'}
                  className={copiedBlue ? 'copied-label copied-blue' : 'copied-label copied-gray'}
                  style={{
                    position: 'absolute',
                    left: `${key.length + 8}ch`,
                    color: copiedBlue ? '#C05D4D' : '#6b7280',
                  }}
                >
                  copied to clipboard
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
