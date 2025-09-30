# Web Deployment Fix Summary

## Problem

The web deployment was configured as a separate Railway service trying to reach the API, but:
1. The API connection wasn't working properly
2. This created unnecessary complexity with CORS and separate service management
3. The API already had code to serve static web files

## Solution

Consolidated to a **single-service deployment** where the API serves both API endpoints and the web UI.

## Changes Made

### 1. Updated `railway.json`
- **Removed**: Separate `web` service
- **Updated**: API service configuration:
  - `rootDirectory`: Changed from `apps/api` to `.` (monorepo root)
  - `buildCommand`: Uses `bun run build` to build both API and web
  - `startCommand`: Runs `bun apps/api/dist/index.js` from root

### 2. Updated `apps/web/src/lib/auctions/apiAdapter.ts`
- Changed `API_BASE` default from `http://localhost:3000` to `''` (relative URLs)
- Added comment explaining the architecture
- Now uses relative URLs like `/api/auctions` when deployed

### 3. Updated `apps/web/astro.config.mjs`
- Added explicit `output: 'static'` configuration
- Ensures Astro generates static files for the API to serve

### 4. Documentation
- Updated `README.md` with deployment architecture explanation
- Created `DEPLOYMENT.md` with comprehensive deployment guide
- Created `.env.example` with environment variable documentation

## How It Works

```
User Request
    │
    ▼
API Server (Port 3000)
    │
    ├─ /api/* ──────► API Routes (JSON responses)
    │
    └─ /* ──────────► Static Files from apps/web/dist/
                      (HTML, CSS, JS, images, etc.)
```

### Request Flow

1. **API Requests** (e.g., `/api/auctions`):
   - Handled by Elysia API routes
   - Return JSON responses

2. **Page Requests** (e.g., `/`, `/auction/123`):
   - Served from `apps/web/dist/index.html` (SPA fallback)
   - Browser loads static JS/CSS bundles
   - Client-side routing takes over

3. **Static Assets** (e.g., `/assets/main-abc123.js`):
   - Served directly from `apps/web/dist/assets/`

## Benefits

✅ **Simplified Deployment**: One service instead of two  
✅ **No CORS Issues**: Same origin for API and web  
✅ **Lower Costs**: Single Railway service  
✅ **Easier Debugging**: All logs in one place  
✅ **Better Performance**: No cross-origin latency  

## Testing Locally

### Development Mode (Separate Servers)
```bash
# Terminal 1: API
bun --cwd apps/api run dev

# Terminal 2: Web (with proxy to API)
PUBLIC_API_BASE=http://localhost:3000 bun --cwd apps/web run dev
```

### Production Mode (Single Server)
```bash
# Build everything
bun run build

# Start (API serves web)
bun apps/api/dist/index.js
```

Open http://localhost:3000 - the API serves both endpoints and UI.

## Deployment Steps

1. Commit and push changes to your repository
2. Railway will automatically detect the updated `railway.json`
3. **Remove the old `web` service** from Railway dashboard if it still exists
4. Ensure environment variables are set on the `api` service:
   - `AUCTION_ENCRYPTION_PASSWORD` (required)
   - `BITCOIN_NETWORK` (optional, defaults to testnet)
5. Railway will rebuild and redeploy with the new configuration
6. Access your application at the API service URL

## Verification

After deployment, verify:

- [ ] Home page loads at the API service URL
- [ ] API calls work (check Network tab in browser DevTools)
- [ ] No CORS errors in browser console
- [ ] Static assets load correctly (CSS, JS, images)
- [ ] Client-side routing works (navigate between pages)
