import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { formatAppVersion } from './src/lib/version.ts'

// Minimal Node typing for the proxy override and git version lookup (avoids
// pulling @types/node into the browser compilation, whose tsconfig "types"
// are restricted).
declare const process: { env: Record<string, string | undefined> }

function git(cmd: string): string | null {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

const exactTag = git('git describe --tags --exact-match HEAD')
const lastTag = exactTag ?? git('git describe --tags --abbrev=0')
const dirty = (git('git status --porcelain') ?? '') !== ''
const appVersion = formatAppVersion(exactTag, lastTag, dirty)

// Dev server listens on all interfaces so it is reachable from outside
// containers (and across WSL). Polling keeps hot reload working through
// Docker bind mounts, where native file-watch events often don't arrive.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
    proxy: {
      '/api': {
        target: process.env.API_PROXY ?? 'http://api:3001',
        changeOrigin: true,
      },
    },
  },
})
