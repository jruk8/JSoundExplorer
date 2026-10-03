import { useEffect, useMemo, useRef, useState } from 'react'
import { compactKeys, namespaceOf, pickMember } from './lib/catalog.ts'
import { DOUBLE_CLICK_MS } from './lib/interaction.ts'
import type { PlayHistoryEntry } from './lib/preferences.ts'
import { Vault } from './components/Vault.tsx'
import { useCatalog } from './hooks/useCatalog.ts'
import { useCopyLabel } from './hooks/useCopyLabel.ts'
import { useHistory } from './hooks/useHistory.ts'
import { useJmh } from './hooks/useJmh.ts'
import { useNamespaces } from './hooks/useNamespaces.ts'
import { usePlayback } from './hooks/usePlayback.ts'
import { usePlayCounts } from './hooks/usePlayCounts.ts'
import { useSurprise } from './hooks/useSurprise.ts'
import { useSwipeGame } from './hooks/useSwipeGame.ts'
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
  const [vault, setVault] = useState(true)
  const [lastAutoKey, setLastAutoKey] = useState<string | null>(null)
  const memberGroups = useMemo(
    () => (catalog ? compactKeys(Object.keys(catalog)) : new Map<string, string[]>()),
    [catalog],
  )
  const memberCacheRef = useRef<{ base: string; member: string; time: number } | null>(null)

  // Resolve a compact row to one real member. The pick sticks for a
  // double-click window so a copy matches the sound just heard.
  function resolveMember(base: string): string {
    const members = memberGroups.get(base) ?? [base]
    const now = Date.now()
    const cached = memberCacheRef.current
    if (
      cached !== null &&
      cached.base === base &&
      now - cached.time < DOUBLE_CLICK_MS &&
      members.includes(cached.member)
    ) {
      return cached.member
    }
    const member = pickMember(members)
    memberCacheRef.current = { base, member, time: now }
    return member
  }
  const history = useHistory()
  const playback = usePlayback({
    catalog,
    offline,
    pitch,
    volume,
    resolveMember,
    onPlay: history.record,
  })
  const copyLabel = useCopyLabel(playback.isPlaying)
  const ns = useNamespaces(catalog)
  const jmh = useJmh(history.entries[0]?.key ?? null, pitch, volume)
  const playCounts = usePlayCounts()

  // The copied label lasts at most as long as the playing sound.
  useEffect(() => {
    if (playback.playingKey === null) {
      copyLabel.hideLabel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playingKey])

  const allKeys = useMemo(() => [...memberGroups.keys()].sort(), [memberGroups])
  const keys = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allKeys.filter(
      (k) => (!q || k.toLowerCase().includes(q)) && ns.isEnabled(namespaceOf(k)),
    )
  }, [allKeys, search, ns.prefs])

  // A row removed from the list stops its sound if playing.
  useEffect(() => {
    if (playback.playingKey !== null && !keys.includes(playback.playingKey)) {
      playback.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, playback.playingKey])

  function handleSoundClick(key: string, auto = false, pitchOverride: number | null = null) {
    if (auto) setLastAutoKey(key)
    const member = resolveMember(key)
    if (copyLabel.resolveClick(key, Date.now(), member) === 'play') {
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

  const surprise = useSurprise({ keys, setPitch, onPick: (key, pitch) => handleSoundClick(key, true, pitch) })
  const game = useSwipeGame({
    keys,
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
        onSwipe={game.open}
      />

      <div className="main">
        <header className="app-header">
          <h1 className="app-title">
            JSoundExplorer{' '}
            <span data-testid="app-version" className="app-version">
              {__APP_VERSION__}
            </span>
          </h1>
          <p data-testid="app-tagline" className="app-tagline">
            {version !== null
              ? `MC${version} Sound Explorer`
              : offline
                ? 'Offline Sound Explorer'
                : loading
                  ? 'Loading Sound Explorer'
                  : 'Online Sound Explorer'}
          </p>
          <nav className="app-links" aria-label="Project links">
            <a href="https://github.com/jruk8/JSoundExplorer" target="_blank" rel="noreferrer">
              » GitHub
            </a>
            <a href="https://jruk8.github.io/JManhunt/" target="_blank" rel="noreferrer">
              » JManhunt
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
      />
      {vault && (
        <Vault keys={allKeys} version={version} play={playback.play} onDone={() => setVault(false)} />
      )}
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
          onDismiss={game.dismiss}
        />
      )}
    </div>
    <footer data-testid="privacy-footer" className="privacy-footer">
      Privacy: play counts are anonymous per-sound totals. No accounts, no cookies, no
      tracking identifiers. Preferences stay in your browser; sounds stream from Mojang's
      CDN; server logs may note IPs like any web server. Questions: see{' '}
      <a href="https://github.com/jruk8/JSoundExplorer">jruk8/JSoundExplorer on GitHub</a>.
    </footer>
    </>
  )
}
