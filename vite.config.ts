import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal Node typing for the proxy override (avoids pulling @types/node
// into the browser compilation, whose tsconfig "types" are restricted).
declare const process: { env: Record<string, string | undefined> }

// Dev server listens on all interfaces so it is reachable from outside
// containers (and across WSL). Polling keeps hot reload working through
// Docker bind mounts, where native file-watch events often don't arrive.
export default defineConfig({
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
