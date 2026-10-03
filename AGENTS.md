# AGENTS.md — JSoundExplorer

Clean-room rebuild of a Minecraft sound explorer. **Do not copy code, assets,
or text from the old SoundExplorer repo** (forked from an all-rights-reserved
source); reimplement from behavior descriptions only.

## Stack

React 18 + TypeScript (strict) + Vite 6. No test harness, no router, no state lib.

## Commands

- `npm run dev` — Vite dev server with HMR (`:5173` in compose)
- `npm run build` — `tsc && vite build` (the verification gate; keep it green)
- `npm run build:pages` — build with relative base for GitHub Pages
- `npm run build:catalog` — regenerate `public/sounds.json` from Mojang
- `docker compose up -d --build` — prod (nginx, `:8080`)
- `docker compose --profile dev up -d --build dev` — dev with hot reload

## Layout

- `src/lib/` — framework-free business logic: `catalog` (types/parse/mock/URLs),
  `playback` (remote ogg + WebAudio blips), `preferences` (localStorage),
  `scripting` (JMHScript format), `interaction` (slider geometry, snap, timing,
  clipboard, easing).
- `src/hooks/` — behavior/state: `useCatalog`, `usePlayback` (single-playback),
  `useCopyLabel` (double-click tracking), `useNamespaces`, `useSurprise`,
  `useJmh`.
- `src/components/` — pure view: `Sidebar`, `Controls`, `SoundList`,
  `ExtrasPanel`, `icons`. `App.tsx` only composes hooks + components.
- `scripts/build-catalog.mjs` — Mojang version manifest → asset index → sounds.json.
- `.github/workflows/` — `build.yml` (CI) and `deploy.yml` (GitHub Pages).

## Conventions

- TS strict with `noUnusedLocals`/`noUnusedParameters`: every import/param
  must be used.
- Import with explicit extensions: `from '../lib/catalog.ts'`,
  `'./Sidebar.tsx'`.
- Behavior hooks use `data-testid` selectors (e.g. `sound-<key>`); keep stable.
- Timings live in `src/lib/interaction.ts` as named constants.
- localStorage key: `jsoundexplorer.namespaceToggles.v1` (namespace prefs
  only; JMHScript selection and surprise options are session-only by design).

## Behaviors (contract — preserve unless asked)

- Click plays a random variant; 2nd click <500ms copies instead (no replay).
- Copied label: accent 0.4s → gray; hides on timeout (1.1s, no-sound fallback),
  any click, or sound end (gray follows long sounds).
- Offline (`sounds.json` unreachable): five `mock.test.*` WebAudio blips.
- Strictly one sound at a time; name highlights in accent while playing.
- Slider detent lines sit exactly on snap points; thumb paints above markers.
- Volume slider is 0–100%; the JMHScript snippet writes gain 0.0–1.0.
- Surprise: ease-out scroll to a random row, short beat, auto-click; any
  user scroll during the run cancels it; never repeats the last pick.

## Verification

- `npm run build` must pass (`tsc` is the type gate).
- `docker compose config --quiet` validates compose files.
- If no JS toolchain is available in the environment, verify via the dev
  server's transformed modules (every `src` module must serve 200) plus
  focused behavior checks; say what was and was not run.
