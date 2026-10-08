import { useEffect, useMemo, useState } from 'react'
import { keyMatchesQuery, namespaceOf } from './lib/catalog.ts'
import { SWIPE_REVEAL_MS } from './lib/interaction.ts'
import { en, formatString } from './locales/en.ts'
import type { SortMode } from './lib/playcounts.ts'
import { sortSoundKeys } from './lib/playcounts.ts'
import type { PlayHistoryEntry } from './lib/preferences.ts'
import { loadSortMode, saveSortMode } from './lib/preferences.ts'
import { Vault } from './components/Vault.tsx'
import { useCatalog } from './hooks/useCatalog.ts'
import { useClassical } from './hooks/useClassical.ts'
import { useCopyLabel } from './hooks/useCopyLabel.ts'
import { useHistory } from './hooks/useHistory.ts'
import { useJmh } from './hooks/useJmh.ts'
import { useNamespaces } from './hooks/useNamespaces.ts'
import { usePlayback } from './hooks/usePlayback.ts'
import { usePlayCounts } from './hooks/usePlayCounts.ts'
import { useSurprise } from './hooks/useSurprise.ts'
import { useSwipeGame } from './hooks/useSwipeGame.ts'
import { useDailyPlays, useHourlyPlays, useMonthlyPlays } from './hooks/useTrendPlays.ts'
import { Controls } from './components/Controls.tsx'
import { OptionsPanel } from './components/OptionsPanel.tsx'
import { Sidebar } from './components/Sidebar.tsx'
import { SoundList } from './components/SoundList.tsx'
import { SwipeGame } from './components/SwipeGame.tsx'

export default function App() {
  const { catalog, version, offline, loading } = useCatalog()
  const [search, setSearch] = useState('')
  const [pitch, setPitch] = useState(1)
  const [volume, setVolume] = useState(100)
  const [sortMode, setSortMode] = useState<SortMode>(loadSortMode)

  useEffect(() => {
    saveSortMode(sortMode)
  }, [sortMode])
  const [vault, setVault] = useState(true)
  const [lastAutoKey, setLastAutoKey] = useState<string | null>(null)
  const history = useHistory()
  const playback = usePlayback({
    catalog,
    offline,
    pitch,
    volume,
    onPlay: history.record,
  })
  const copyLabel = useCopyLabel(playback.isPlaying)
  const ns = useNamespaces(catalog)
  const jmh = useJmh(history.entries[0]?.key ?? null, pitch, volume)
  const playCounts = usePlayCounts()
  const hourly = useHourlyPlays()
  const daily = useDailyPlays()
  const monthly = useMonthlyPlays()
  const globalPlays = Object.values(playCounts.counts).reduce((sum, n) => sum + n, 0)

  // The copied label lasts at most as long as the playing sound.
  useEffect(() => {
    if (playback.playingKey === null) {
      copyLabel.hideLabel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playingKey])

  const allKeys = useMemo(() => (catalog ? Object.keys(catalog).sort() : []), [catalog])
  const keys = useMemo(() => {
    const filtered = allKeys.filter(
      (k) => keyMatchesQuery(k, search) && ns.isEnabled(namespaceOf(k)),
    )
    return sortSoundKeys(filtered, playCounts.counts, sortMode)
  }, [allKeys, search, ns.prefs, playCounts.counts, sortMode])

  // A row removed from the list stops its sound if playing. Internal
  // UI sounds are exempt: no category gates them.
  useEffect(() => {
    if (
      playback.playingKey !== null &&
      !playback.isInternalPlaying() &&
      !keys.includes(playback.playingKey)
    ) {
      playback.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, playback.playingKey])

  const classical = useClassical({
    soundKey: history.entries[0]?.key ?? null,
    pitch,
    volume,
    catalog,
    stopPlayback: playback.stop,
  })

  function handleSoundClick(key: string, auto = false, pitchOverride: number | null = null) {
    if (auto) setLastAutoKey(key)
    if (copyLabel.resolveClick(key, Date.now()) === 'play') {
      if (!auto && key !== lastAutoKey) {
        setLastAutoKey(null)
      }
      playback.play(key, pitchOverride === null ? undefined : { pitch: pitchOverride })
      playCounts.recordPlay(key)
    }
  }

  // History jumps ensure the row's namespace is on, then reuse the
  // surprise machinery (single click) or jump instantly (double click).
  function ensureNamespace(key: string): boolean {
    const name = namespaceOf(key)
    if (ns.isEnabled(name)) return false
    ns.enableNamespace(name)
    return true
  }

  function handleHistorySelect(entry: PlayHistoryEntry) {
    if (ensureNamespace(entry.key)) {
      // Let the list re-render before measuring the row.
      window.setTimeout(() => surprise.spotlight(entry.key, entry.pitch), 0)
    } else {
      surprise.spotlight(entry.key, entry.pitch)
    }
  }

  function handleHistoryInstant(entry: PlayHistoryEntry) {
    if (ensureNamespace(entry.key)) {
      window.setTimeout(() => surprise.jumpTo(entry.key, entry.pitch), 0)
    } else {
      surprise.jumpTo(entry.key, entry.pitch)
    }
  }

  const surprise = useSurprise({
    keys,
    setPitch,
    onPick: (key, pitch) => handleSoundClick(key, true, pitch),
    fadeOutCurrent: playback.fadeOutCurrent,
  })
  const game = useSwipeGame({
    keys,
    soundPool: allKeys,
    volume,
    pitch,
    randomizePitch: surprise.surprisePitch,
    playingKey: playback.playingKey,
    play: playback.play,
    stop: playback.stop,
    spotlight: surprise.spotlight,
    recordPlay: playCounts.recordPlay,
  })

  return (
    <>
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
        onSwipe={() => {
          classical.stop()
          game.open()
        }}
        classicalDisabled={loading || offline || history.entries[0] == null}
        classicalPlaying={classical.playing}
        onClassical={classical.toggle}
      />

      <div className="main">
        <header className="app-header">
          <h1 className="app-title">
            {en.app.title}{' '}
            <span data-testid="app-version" className="app-version">
              {__APP_VERSION__}
            </span>
          </h1>
          <p data-testid="app-tagline" className="app-tagline">
            {version !== null
              ? formatString(en.app.tagline, { version })
              : offline
                ? en.app.taglineOffline
                : loading
                  ? en.app.taglineLoading
                  : en.app.taglineOnline}
          </p>
          <nav className="app-links" aria-label={en.app.linksLabel}>
            <a href="https://github.com/jruk8/JSoundExplorer" target="_blank" rel="noreferrer">
              {en.app.githubLink}
            </a>
            <a href="https://jruk8.github.io/JManhunt/" target="_blank" rel="noreferrer">
              {en.app.jmanhuntLink}
            </a>
            <a href="https://github.com/jruk8" target="_blank" rel="noreferrer">
              {en.app.authorLink}
            </a>
          </nav>
        </header>

        <Controls
          search={search}
          onSearchChange={setSearch}
          pitch={pitch}
          onPitchChange={setPitch}
          volume={volume}
          onVolumeChange={setVolume}
          sortMode={sortMode}
          onSortChange={setSortMode}
        />

        <SoundList
          loading={loading}
          keys={keys}
          playingKey={playback.playingKey}
          lastAutoKey={lastAutoKey}
          counts={playCounts.counts}
          copiedKey={copyLabel.copiedKey}
          copiedBlue={copyLabel.copiedBlue}
          onSoundClick={handleSoundClick}
        />
      </div>

      <OptionsPanel
        jmhText={jmh.jmhText}
        jmhCopied={jmh.jmhCopied}
        onCopy={jmh.copyJmh}
        command={jmh.command}
        onCommandChange={jmh.setCommand}
        entries={history.entries}
        onHistorySelect={handleHistorySelect}
        onHistoryInstant={handleHistoryInstant}
        hourly={hourly}
        daily={daily}
        monthly={monthly}
        globalPlays={globalPlays}
      />
      {vault && (
        <Vault keys={allKeys} version={version} loading={loading} play={playback.play} onDone={() => setVault(false)} />
      )}
      {game.active && (
        <SwipeGame
          closing={game.closing}
          overlayReady={game.overlayReady}
          soundKey={game.current?.key ?? null}
          cardKey={game.cardKey}
          playing={game.current !== null && playback.playingKey === game.current.key}
          roundNo={game.roundNo}
          left={game.cardsLeft}
          discarded={game.discarded}
          picked={game.pickedCount}
          onFlipStart={() => playback.fadeOutCurrent(SWIPE_REVEAL_MS / 2)}
          onRevealPlay={game.revealPlay}
          onCommit={game.commitThrow}
          onExit={game.exitThrow}
          onTogglePlay={game.togglePlay}
          onDismiss={game.dismiss}
        />
      )}
    </div>
    <footer data-testid="privacy-footer" className="privacy-footer">
      {en.footer.text}
      <a href="https://github.com/jruk8/JSoundExplorer">{en.footer.link}</a>
      {en.footer.suffix}
    </footer>
    </>
  )
}
