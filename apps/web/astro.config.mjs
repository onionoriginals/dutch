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
    server: {
      host: true,
      hmr: {
        port: 4321
      }
    },
    preview: {
      allowedHosts: [
        'dutch-production.up.railway.app'
      ],
      host: true,
      port: 4321
    }
  }
})
