import { defineConfig } from 'astro/config'

export default defineConfig({
  server: {
    host: true,
    port: 4321,
    allowedHosts: true
  },
  preview: {
    host: true,
    port: 4321,
    allowedHosts: true
  },
  vite: {
    resolve: {
      // Prefer the "browser" export condition so @originals/dutch resolves to its browser build
      conditions: ['browser']
    },
    build: {
      rollupOptions: {
        external: ['bun:sqlite', 'bun:test']
      }
    },
    optimizeDeps: {
      exclude: ['bun:sqlite', 'bun:test']
    }
  }
})
