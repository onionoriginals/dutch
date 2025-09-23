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
