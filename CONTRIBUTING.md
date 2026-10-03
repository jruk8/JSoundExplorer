# Contributing to JSoundExplorer

## Setup

- Prereqs: Node 22+ (or Docker with the compose setup).
- `npm install`
- `npm run dev`, then open http://localhost:5173 in a browser.
- The first install generates `package-lock.json`; commit it » Dependabot's
  npm updates need it.
- Play counts need the stack: `cp .env.example .env` (first time only),
  then use compose below » MariaDB + counts API come up with it.

## Build & run

- `npm run build` » typecheck (`tsc`) + production build into `dist/`.
- `npm run build:pages` » same with a relative base, for GitHub Pages.
- `npm run build:catalog` » regenerate `public/sounds.json` from Mojang.
- Production container: `docker compose up -d --build`, then open
  http://localhost:8080 in a browser.
- Dev container (hot reload, source bind-mounted):
  `docker compose --profile dev up -d --build dev`, then open
  http://localhost:5173 in a browser.
- The header version is baked from git tags when the build runs or the dev
  server starts (`-SNAPSHOT` when dirty or untagged) » restart the dev
  server after tagging to pick up a new release version.
- Stop everything: `docker compose --profile dev down`.
- CI (`build.yml`, on push/PR): install, compose validation, best-effort
  catalog fetch, build, dist artifact upload.

## Play counts (MariaDB + API)

- `docker compose up` also starts `db` (MariaDB 11, data in the `dbdata`
  volume) and `api` (counts service, `server/`).
- Plays batch-upload every 5s and flush on tab hide/close; totals refresh
  every 10s. Counts are anonymous per-sound sums » see the footer note.
- Configure via `.env` (`DB_NAME`, `DB_USER`, `DB_PASSWORD`,
  `DB_ROOT_PASSWORD`); without it, dev defaults apply.
- Inspect: `docker compose exec db mariadb -uroot -p -e 'SELECT * FROM
  plays ORDER BY plays DESC LIMIT 20'` (prompts for the root password;
  add `--database=$DB_NAME` if you renamed it).
- Bare `npm run dev` (no compose) simply shows no counts » the app degrades
  gracefully when `/api` is unreachable.
- GitHub Pages is static-only, so it cannot run MariaDB: host `db`+`api`
  on your own server (plain `docker compose up` there), expose the API over
  public HTTPS, set `CORS_ORIGIN` to the Pages origin, and set the repo
  variable `VITE_API_BASE` to the API origin » `deploy.yml` bakes it in.
  Browsers block HTTP APIs from HTTPS pages, so HTTPS is required.
- On a bare host: `git clone https://github.com/jruk8/JSoundExplorer.git`,
  `cp .env.example .env`, set secrets + `CORS_ORIGIN`. You only need the
  backend: `docker compose up -d db api` (skips the frontend services).
- Public HTTPS via Caddy: point a DNS name at the host, then
  `API_ORIGIN=api.example.com docker compose -f docker-compose.yml
  -f docker-compose.tls.yml up -d db api tls`.

## Conventions

- TypeScript strict: no unused locals/params; explicit `.ts`/`.tsx` import
  extensions (`from '../lib/catalog.ts'`).
- Conventional Commits (`feat:`, `fix:`, `docs:`, …) » the changelog and
  release notes are generated from them, so keep the type prefix accurate.
- Clean-room only: never copy code, assets, or text from the old
  SoundExplorer fork.

## Releasing (tag-driven, Axion-style)

- The version comes from git tags, not from files: tag `x.y.z`
  (a leading `v`, e.g. `v1.2.3`, is tolerated and stripped).
- To cut a release: push `main`, then `git tag 1.2.3 && git push origin 1.2.3`.
- `release.yml` validates the tag, builds, attaches `dist.zip`, and publishes
  a GitHub Release with git-cliff notes. Anything not shaped `x.y.z` fails fast.
- Pages deploys (`deploy.yml`) run on version tags only, same filter as releases.

## Changelog (git-cliff)

- Config lives in `cliff.toml` (Conventional Commits groups).
- Install git-cliff (cargo, package manager, or release binary), then:
  - preview unreleased changes: `git cliff --unreleased`
  - regenerate the file: `git cliff -o CHANGELOG.md`
  - notes for the latest tag: `git cliff --latest`
- Dependabot opens update PRs weekly (npm, Docker, GitHub Actions) with
  `chore(deps):` commits, which the changelog groups under Dependencies.
