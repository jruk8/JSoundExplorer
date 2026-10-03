import { cardTitle } from '../lib/catalog.ts'
import type { SwipeDirection } from '../lib/interaction.ts'
import { en, formatString } from '../locales/en.ts'
import { SwipeCard } from './SwipeCard.tsx'

export interface SwipeGameProps {
  closing: boolean
  overlayReady: boolean
  soundKey: string | null
  cardKey: string
  playing: boolean
  roundNo: number
  left: number
  discarded: number
  picked: number
  onFlipStart: () => void
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
  roundNo,
  left,
  discarded,
  picked,
  onFlipStart,
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
      aria-label={en.swipe.dialogLabel}
      aria-modal="true"
    >
      <div className="swipe-dim" onClick={onDismiss} />
      {!closing && overlayReady && soundKey !== null && (
        <div className="swipe-stage">
          <div key={roundNo} className="swipe-hud" data-testid="swipe-hud">
            <div className="swipe-round">{formatString(en.swipe.round, { n: roundNo })}</div>
            <div className="swipe-tally">
              <span className="swipe-left">{left}</span>
              <span className="swipe-sep">|</span>
              <span className="swipe-discarded">{discarded}</span>
              <span className="swipe-sep">|</span>
              <span className="swipe-picked">{picked}</span>
            </div>
          </div>
          <SwipeCard
            key={cardKey}
            title={cardTitle(soundKey)}
            playing={playing}
            onFlipStart={onFlipStart}
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
