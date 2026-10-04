# AGENTS.md » JSoundExplorer

Clean-room rebuild of a Minecraft sound explorer. **Do not copy code, assets,
or text from the old SoundExplorer repo** (forked from an all-rights-reserved
source); reimplement from behavior descriptions only.

## Stack

React 18 + TypeScript (strict) + Vite 6. Vitest (+ jsdom, Testing Library)
for unit/hook tests; no router, no state lib.

## Commands

- `npm run dev` » Vite dev server with HMR (`:5173` in compose)
- `npm run build` » `tsc && vite build` (the verification gate; keep it green)
- `npm run build:pages` » build with relative base for GitHub Pages
- `npm run build:catalog` » regenerate `public/sounds.json` from Mojang
- `docker compose up -d --build` » prod (nginx, `:8080`)
- `docker compose --profile dev up -d --build dev` » dev with hot reload
- Contributor workflows (dev, release, changelog): see CONTRIBUTING.md.

## Layout

- `src/lib/` » framework-free business logic: `catalog` (types/parse/mock/URLs),
  `playback` (remote ogg + WebAudio blips), `preferences` (localStorage),
  `scripting` (JMHScript format), `interaction` (slider geometry, snap, timing,
  clipboard, easing), `playcounts` (count formatting, counts API client),
  `version` (git-tag display version), `midi` (SMF parse, bundled piece
  URLs, note-rate map), `pitch` (sample base-pitch detection).
- `src/hooks/` » behavior/state: `useCatalog`, `usePlayback` (single-playback),
  `useCopyLabel` (double-click tracking), `useNamespaces`, `useSurprise`,
  `useSwipeGame`, `usePlayCounts`, `useJmh`, `useHistory` (persisted plays),
  `useClassical` (MIDI performance scheduler), `useTrendPlays`
  (hourly/daily/monthly series).
- `src/components/` » pure view: `Sidebar`, `Controls`, `SoundList`,
  `OptionsPanel`, `CommandSelect`, `HistoryList`, `SwipeGame`, `SwipeCard`,
  `Vault`, `TrendChart` (hourly/daily/monthly), `icons`. `App.tsx` only
  composes hooks + components.
- `scripts/build-catalog.mjs` » Mojang version manifest → asset index → sounds.json.
- `server/` » counts API + sample byte-proxy (node:http + mysql2) + its Dockerfile; `db`
  (MariaDB) alongside in compose; `docker-compose.tls.yml` adds a Caddy
  HTTPS front door for Pages mode.
- `.github/workflows/` » `build.yml` (CI), `deploy.yml` (Pages),
  `release.yml` (tag-driven GitHub Releases); `.github/dependabot.yml`.
- `cliff.toml` » git-cliff changelog config (Conventional Commits).
- `CONTRIBUTING.md` » contributor workflows.

## Conventions

- TS strict with `noUnusedLocals`/`noUnusedParameters`: every import/param
  must be used.
- Import with explicit extensions: `from '../lib/catalog.ts'`,
  `'./Sidebar.tsx'`.
- Behavior hooks use `data-testid` selectors (e.g. `sound-<key>`); keep stable.
- Timings live in `src/lib/interaction.ts` as named constants.
- User-facing strings live in `src/locales/en.ts` (nested, Crowdin-shaped;
  `{name}` placeholders via `formatString`); JMHScript protocol text and
  count units stay in code.
- localStorage key: `jsoundexplorer.namespaceToggles.v1` (namespace prefs
  only; JMHScript selection and surprise options are session-only by design).

## Behaviors (contract » preserve unless asked)

- Click plays a random variant; 2nd click <500ms copies instead (no replay).
- Copied label: accent 0.4s → gray; hides on timeout (1.1s, no-sound fallback),
  any click, or sound end (gray follows long sounds).
- Offline (`sounds.json` unreachable): five `mock.test.*` WebAudio blips.
- Strictly one sound at a time; name highlights in accent while playing.
- Slider detent lines sit exactly on snap points; thumb paints above markers.
- Volume slider is 0–100%; the JMHScript snippet writes gain 0.0–1.0.
- Surprise: ease-out scroll to a random row, short beat, auto-click; any
  user scroll during the run cancels it; never repeats the last pick.
- Swipe!: six-card Tinder game (flip reveal + autoplay, drag to throw
  left/right with spin, runoff rounds, winner spotlights; dim-click/Escape
  dismisses (lone pick spotlights); rounds reshuffle, and the last
  auto-played row stays marked; card pitch randomizes only when
  Also-pitch is on.
- Numeric siblings compact to one row (break1..4 » break); interactions
  resolve a random real member internally.
- Escape stops any playing sound.
- Auto-mark is a focus-style outline box; playing another row clears it.
- Right-swipe replays at 1.15x gain (mock path unclamped; remote caps at
  the element ceiling).
- Play counts: anonymous per-base totals in MariaDB; rows show compact
  counts (1.0K), hidden at zero; 5s batched upload, 10s refresh.
- Play Classical!: a random bundled MIDI piece on the latest history
  sound (sample base pitch auto-detected as the key anchor, middle C
  fallback; velocity dynamics, sustain pedal honored, freely
  overlapping notes with 100ms release fades); sliders retune live
  notes; stops only on toggle/Escape/swipe, while another pick or
  surprise switches the sound for the rest instead; disabled with
  empty history or offline.
- Trend charts: hourly (8h), daily (7d), monthly (12m) polled series.

## Verification

- `npm run build` must pass (`tsc` is the type gate).
- `docker compose config --quiet` validates compose files.
- If no JS toolchain is available in the environment, verify via the dev
  server's transformed modules (every `src` module must serve 200) plus
  focused behavior checks; say what was and was not run.
