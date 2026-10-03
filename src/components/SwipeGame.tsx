import { shortId } from '../lib/catalog.ts'
import type { SwipeDirection } from '../lib/interaction.ts'
import { SwipeCard } from './SwipeCard.tsx'

export interface SwipeGameProps {
  closing: boolean
  overlayReady: boolean
  soundKey: string | null
  cardKey: string
  playing: boolean
  onRevealPlay: () => void
  onCommit: (dir: SwipeDirection) => void
  onExit: (dir: SwipeDirection) => void
  onTogglePlay: () => void
  onDismiss: () => void
}

export function SwipeGame({
  closing,
  overlayReady,
  soundKey,
  cardKey,
  playing,
  onRevealPlay,
  onCommit,
  onExit,
  onTogglePlay,
  onDismiss,
}: SwipeGameProps) {
  return (
    <div
      className={closing ? 'swipe-root closing' : 'swipe-root'}
      data-testid="swipe-game"
      role="dialog"
      aria-label="Swipe game"
      aria-modal="true"
    >
      <div className="swipe-dim" onClick={onDismiss} />
      {!closing && overlayReady && soundKey !== null && (
        <div className="swipe-stage">
          <SwipeCard
            key={cardKey}
            shortId={shortId(soundKey)}
            playing={playing}
            onRevealPlay={onRevealPlay}
            onCommit={onCommit}
            onExit={onExit}
            onTogglePlay={onTogglePlay}
          />
        </div>
      )}
    </div>
  )
}
