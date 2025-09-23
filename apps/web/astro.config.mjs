import { defineConfig } from 'astro/config'

export default defineConfig({
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
      ]
      host: true,
      port: 4321
    }
  }
})
