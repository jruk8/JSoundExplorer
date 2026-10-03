import { formatPlays } from '../lib/playcounts.ts'
import { en } from '../locales/en.ts'

export interface SoundListProps {
  loading: boolean
  keys: string[]
  playingKey: string | null
  lastAutoKey: string | null
  counts: Record<string, number>
  copiedKey: string | null
  copiedBlue: boolean
  onSoundClick: (key: string) => void
}

export function SoundList({
  loading,
  keys,
  playingKey,
  lastAutoKey,
  counts,
  copiedKey,
  copiedBlue,
  onSoundClick,
}: SoundListProps) {
  if (loading) {
    return (
      <main className="list-wrap">
        <p className="muted">{en.list.loading}</p>
      </main>
    )
  }
  if (keys.length === 0) {
    return (
      <main className="list-wrap">
        <p className="muted">{en.list.empty}</p>
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
              className={[
                'sound-row',
                playingKey === key && 'playing',
                lastAutoKey === key && 'auto-marked',
              ]
                .filter(Boolean)
                .join(' ')}
              data-testid={`sound-${key}`}
              data-key={key}
              data-playing={playingKey === key ? 'true' : undefined}
              data-auto={lastAutoKey === key ? 'true' : undefined}
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
                  {en.list.copied}
                </span>
              )}
              {(counts[key] ?? 0) > 0 && (
                <span data-testid="play-count" className="play-count">
                  {formatPlays(counts[key] ?? 0)}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
