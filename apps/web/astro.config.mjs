import { defineConfig } from 'astro/config'
import tailwind from '@astrojs/tailwind'
import react from '@astrojs/react'

export default defineConfig({
  integrations: [tailwind({ applyBaseStyles: false }), react()],
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
      conditions: ['browser'],
      alias: [
        { find: '@originals/dutch/browser', replacement: new URL('../../packages/dutch/src/browser.ts', import.meta.url).pathname },
        { find: '@originals/dutch', replacement: new URL('../../packages/dutch/src/index.ts', import.meta.url).pathname },
      ]
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
