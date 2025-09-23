import { defineConfig } from 'astro/config'

export default defineConfig({
  server: { 
    port: 4321, 
    host: true 
  },
  preview: {
    port: 4321,
    host: true,
    allowedHosts: [
      'dutch-production.up.railway.app',
      'localhost',
      '127.0.0.1',
      '0.0.0.0'
    ]
  },
  vite: {
    server: {
      host: true,
      hmr: {
        port: 4321
      }
    },
    preview: {
      host: true,
      port: 4321
    }
  }
})
