import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'

export default defineConfig({
  integrations: [tailwind({ applyBaseStyles: false })],
  server: {
    host: true,
    port: 4321
  },
  preview: {
    host: true,
    port: 4321
  },
  vite: {
    preview: {
      // Allow Railway preview host header
      allowedHosts: ['dutch-production.up.railway.app']
    },
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
