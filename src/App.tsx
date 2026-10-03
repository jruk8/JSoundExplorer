import { useEffect, useMemo, useRef, useState } from 'react'
import { compactKeys, namespaceOf, pickMember } from './lib/catalog.ts'
import { DOUBLE_CLICK_MS } from './lib/interaction.ts'
import { useCatalog } from './hooks/useCatalog.ts'
import { useCopyLabel } from './hooks/useCopyLabel.ts'
import { useJmh } from './hooks/useJmh.ts'
import { useNamespaces } from './hooks/useNamespaces.ts'
import { usePlayback } from './hooks/usePlayback.ts'
import { usePlayCounts } from './hooks/usePlayCounts.ts'
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
  const playback = usePlayback({ catalog, offline, pitch, volume, resolveMember })
  const copyLabel = useCopyLabel(playback.isPlaying)
  const ns = useNamespaces(catalog)
  const jmh = useJmh(pitch, volume)
  const playCounts = usePlayCounts()

  // The copied label lasts at most as long as the playing sound.
  useEffect(() => {
    if (playback.playingKey === null) {
      copyLabel.hideLabel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.playingKey])

  const keys = useMemo(() => {
    const all = [...memberGroups.keys()].sort()
    const q = search.trim().toLowerCase()
    return all.filter(
      (k) => (!q || k.toLowerCase().includes(q)) && ns.isEnabled(namespaceOf(k)),
    )
  }, [memberGroups, search, ns.prefs])

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
    jmh.selectKey(member)
    if (copyLabel.resolveClick(key, Date.now(), member) === 'play') {
      if (!auto && key !== lastAutoKey) {
        setLastAutoKey(null)
      }
      playback.play(key, pitchOverride === null ? undefined : { pitch: pitchOverride })
      playCounts.recordPlay(key)
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
          lastAutoKey={lastAutoKey}
          counts={playCounts.counts}
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
