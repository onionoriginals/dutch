import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindPostcss from '@tailwindcss/postcss'
import autoprefixer from 'autoprefixer'

export default defineConfig({
  integrations: [react()],
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
    css: {
      postcss: {
        plugins: [tailwindPostcss(), autoprefixer()]
      }
    },
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
