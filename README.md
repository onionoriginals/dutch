# dutch
# Originals Monorepo

Monorepo using Bun workspaces with:

- apps/api: Elysia backend (Bun)
- apps/web: Astro client
- packages/dutch: Shared TypeScript library `@originals/dutch`

## Commands

- Root
  - `bun run dev` — run dev for all apps via turbo (requires separate scripts inside apps)
  - `bun run build` — build all
  - `bun run start` — start all

- API
  - `bun --cwd apps/api run dev`

- Web
  - `bun --cwd apps/web run dev`

- Library
  - `bun --cwd packages/dutch run dev`

- Testing
  - `bun test`

## Deployment

The application deploys as a single service on Railway:

- **Single API Service**: The API server (Elysia/Bun) serves both:
  1. API endpoints at `/api/*`
  2. Static web UI files from `apps/web/dist/`
  
- **Build Process**: 
  - `bun run build` builds both the web app (Astro → static files) and the API
  - The API includes a catch-all route that serves the built web files
  
- **No Separate Web Service**: The web app does not need its own deployment. The API handles all HTTP traffic, serving the web UI for browser requests and JSON for API calls.

This architecture simplifies deployment and avoids CORS issues since everything is served from the same origin.