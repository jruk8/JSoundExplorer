import { useEffect, useMemo, useState } from 'react'
import { namespaceOf } from './lib/catalog.ts'
import { useCatalog } from './hooks/useCatalog.ts'
import { useCopyLabel } from './hooks/useCopyLabel.ts'
import { useJmh } from './hooks/useJmh.ts'
import { useNamespaces } from './hooks/useNamespaces.ts'
import { usePlayback } from './hooks/usePlayback.ts'
import { useSurprise } from './hooks/useSurprise.ts'
import { useSwipeGame } from './hooks/useSwipeGame.ts'
import { Controls } from './components/Controls.tsx'
import { ExtrasPanel } from './components/ExtrasPanel.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { SoundList } from './components/SoundList.tsx'
import { SwipeGame } from './components/SwipeGame.tsx'

export default function App() {
  const { catalog, version, offline, loading } = useCatalog()
  const [search, setSearch] = useState('')
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(100)
  const playback = usePlayback({ catalog, offline, pitch, volume })
  const copyLabel = useCopyLabel(playback.isPlaying)
  const ns = useNamespaces(catalog)
  const jmh = useJmh(pitch, volume)

  // The copied label lasts at most as long as the playing sound.
  useEffect(() => {
    if (playback.playingKey === null) {
      copyLabel.hideLabel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playingKey])

  const keys = useMemo(() => {
    if (!catalog) return []
    const all = Object.keys(catalog).sort()
    const q = search.trim().toLowerCase()
    return all.filter(
      (k) => (!q || k.toLowerCase().includes(q)) && ns.isEnabled(namespaceOf(k)),
    )
  }, [catalog, search, ns.prefs])

  function handleSoundClick(key: string) {
    jmh.selectKey(key)
    if (copyLabel.resolveClick(key, Date.now()) === 'play') {
      playback.play(key)
    }
  }

  const surprise = useSurprise({ keys, setPitch, onPick: handleSoundClick })
  const game = useSwipeGame({
    keys,
    volume,
    playingKey: playback.playingKey,
    play: playback.play,
    stop: playback.stop,
    spotlight: surprise.spotlight,
  })

  return (
    <div className="app">
      <Sidebar
        namespaces={ns.namespaces}
        counts={ns.counts}
        isEnabled={ns.isEnabled}
        allOn={ns.allOn}
        onToggleAll={ns.toggleAll}
        onToggleNamespace={ns.toggleNamespace}
        surpriseDisabled={keys.length === 0}
        onSurprise={surprise.surprise}
        surprisePitch={surprise.surprisePitch}
        onSurprisePitchChange={surprise.setSurprisePitch}
        swipeDisabled={keys.length === 0}
        onSwipe={game.open}
      />

      <div className="main">
        <header className="app-header">
          <h1 className="app-title">JSoundExplorer</h1>
          <span data-testid="status" className="app-status">
            {offline ? 'offline (mock)' : version ? `v${version}` : loading ? 'loading…' : 'online'}
          </span>
        </header>

        <Controls
          search={search}
          onSearchChange={setSearch}
          pitch={pitch}
          onPitchChange={setPitch}
          volume={volume}
          onVolumeChange={setVolume}
        />

        <SoundList
          loading={loading}
          keys={keys}
          playingKey={playback.playingKey}
          copiedKey={copyLabel.copiedKey}
          copiedBlue={copyLabel.copiedBlue}
          onSoundClick={handleSoundClick}
        />
      </div>

      <ExtrasPanel jmhText={jmh.jmhText} jmhCopied={jmh.jmhCopied} onCopy={jmh.copyJmh} />
      {game.active && (
        <SwipeGame
          closing={game.closing}
          overlayReady={game.overlayReady}
          soundKey={game.current?.key ?? null}
          cardKey={game.cardKey}
          playing={game.current !== null && playback.playingKey === game.current.key}
          onRevealPlay={game.revealPlay}
          onCommit={game.commitThrow}
          onExit={game.exitThrow}
          onTogglePlay={game.togglePlay}
        />
      )}
    </div>
  )
}
