import { defineConfig } from 'astro/config'

export default defineConfig({
  server: {
    host: true,
    port: 4321
  },
  preview: {
    host: true,
    port: 4321
  },
  vite: {
    build: {
      rollupOptions: {
        external: ['bun:sqlite']
      }
    },
    optimizeDeps: {
      exclude: ['bun:sqlite']
    }
  }
})
