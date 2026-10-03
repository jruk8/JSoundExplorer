# JSoundExplorer
Sound Explorer for Minecraft sounds, natively JMHScript compatible.

## Run with Docker

Dev with hot reload (source is bind-mounted, edits apply live):

```sh
docker compose --profile dev up -d --build dev
```

then open http://localhost:5173 in a browser.

Production build (static files via nginx):

```sh
docker compose up -d --build
```

then open http://localhost:8080 in a browser.

Stop everything with `docker compose --profile dev down`. The sound catalog
is fetched at image build/start time; refresh it locally any time with
`npm run build:catalog`.
