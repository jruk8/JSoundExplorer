import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
