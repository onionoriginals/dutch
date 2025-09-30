# Deployment Guide

## Architecture

This application uses a **single-service architecture** where the API server serves both the API endpoints and the web UI:

```
                    Railway Deployment
                           │
                    ┌──────▼──────┐
                    │  API Service │
                    │  (Port 3000) │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
         ┌────▼─────┐            ┌─────▼──────┐
         │   /api/* │            │     /*     │
         │  Routes  │            │  Static UI │
         │  (JSON)  │            │   (HTML)   │
         └──────────┘            └────────────┘
```

## Railway Configuration

The `railway.json` defines a single service:

- **Service**: `api`
- **Root Directory**: `.` (monorepo root)
- **Build Command**: `bun run build` (builds both API and web)
- **Start Command**: `bun apps/api/dist/index.js`

### What Happens During Deployment

1. **Install**: `bun install --frozen-lockfile` installs all dependencies
2. **Build**: 
   - Turbo runs build for all workspaces
   - `apps/web` builds the Astro app → `apps/web/dist/`
   - `apps/api` bundles the API → `apps/api/dist/index.js`
3. **Start**: The API server starts and:
   - Serves API endpoints at `/api/*`
   - Serves static files from `apps/web/dist/` for all other routes

## Environment Variables

Required for production:

- `AUCTION_ENCRYPTION_PASSWORD` - Password for encrypting private keys
- `PORT` - Server port (Railway sets this automatically)

Optional:

- `BITCOIN_NETWORK` - `mainnet`, `testnet`, `signet`, or `regtest` (default: `testnet`)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `LOG_LEVEL` - `debug`, `info`, `warn`, `error` (default: `info`)
- `LOG_FORMAT` - `text` or `json` (default: `text`)

## Local Development

### Option 1: Run Both Services Separately

```bash
# Terminal 1: API
bun --cwd apps/api run dev

# Terminal 2: Web (with API proxy)
PUBLIC_API_BASE=http://localhost:3000 bun --cwd apps/web run dev
```

The web dev server runs on port 4321 and connects to the API on port 3000.

### Option 2: Production-like (API Serves Web)

```bash
# Build everything
bun run build

# Start API (which serves the built web app)
bun apps/api/dist/index.js
```

Open http://localhost:3000 to see the web UI served by the API.

## Deployment Checklist

1. ✅ Removed separate `web` service from `railway.json`
2. ✅ Updated `API_BASE` in web app to use relative URLs
3. ✅ Verified API serves static files from `apps/web/dist/`
4. ✅ Set `AUCTION_ENCRYPTION_PASSWORD` in Railway environment variables
5. ✅ Verified build command builds both API and web

## Troubleshooting

### Web UI shows 404 errors

- Ensure `bun run build` completes successfully
- Verify `apps/web/dist/` directory exists after build
- Check API logs for static file serving errors

### API calls fail from web UI

- Verify the web app is using relative URLs (`/api/*`)
- Check CORS configuration in `apps/api/src/index.ts`
- Review API logs for request errors

### Build fails on Railway

- Check that all dependencies are listed in package.json files
- Verify workspace dependencies use `workspace:*` protocol
- Review build logs for specific error messages
