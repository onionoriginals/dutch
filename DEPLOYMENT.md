# Deployment Guide

## Hosting Strategy

This monorepo supports **two deployment strategies**:

### Strategy 1: Separate Services (Current Railway Config)

Deploy the web frontend and API backend as separate services.

- **API Service**: Serves REST API endpoints at `/api/*`, `/health`, etc.
- **Web Service**: Serves the static Astro site with pages and assets

**Advantages:**
- Clean separation of concerns
- Independent scaling
- Easier to manage different resource allocations

**Configuration:**

```json
// railway.json
{
  "services": [
    {
      "name": "api",
      "rootDirectory": "apps/api",
      "startCommand": "bun run start",
      "healthcheckPath": "/health"
    },
    {
      "name": "web",
      "rootDirectory": "apps/web",
      "startCommand": "bun run start",
      "healthcheckPath": "/"
    }
  ]
}
```

**Environment Variables:**
- **API**: Set `ALLOWED_ORIGINS` to include the web service URL
- **Web**: Configure API base URL for client-side requests

---

### Strategy 2: Unified Service (API Serves UI)

The API already has built-in static file serving for the web UI.

**How it works:**
- API serves UI static files from `apps/web/dist/` (lines 106-118, 820-846 in `apps/api/src/index.ts`)
- Root path (`/`) serves `index.html`
- Static assets (`.css`, `.js`, `.html`) are served via wildcard route
- API endpoints accessible at `/api/*` and direct routes like `/health`, `/auctions`

**To deploy as unified service:**

1. **Build both apps:**
   ```bash
   cd /workspace
   bun --cwd apps/web run build
   bun --cwd apps/api run build
   ```

2. **Ensure web dist is accessible to API:**
   The API uses relative path resolution:
   ```typescript
   const indexUrl = new URL('../../web/dist/index.html', import.meta.url)
   ```

3. **Deploy only the API service:**
   ```json
   // railway.json (simplified)
   {
     "services": [
       {
         "name": "api",
         "rootDirectory": "apps/api",
         "buildCommand": "cd ../.. && bun --cwd apps/web run build && bun --cwd apps/api run build",
         "startCommand": "bun run start",
         "healthcheckPath": "/health"
       }
     ]
   }
   ```

**Advantages:**
- Single service to manage
- Lower hosting costs
- No CORS configuration needed
- Simpler deployment

---

## Current Production Commands

### Web Service (`apps/web/package.json`)

```json
{
  "scripts": {
    "dev": "astro dev --port 4321 --host",
    "build": "astro build",
    "start": "astro preview --host 0.0.0.0 --port 4321"
  }
}
```

**Why `astro preview`?**
- Astro's built-in static file server
- Serves the compiled `dist/` directory
- Handles routing for SSR and static pages
- Listens on all interfaces (`0.0.0.0`) for container networking

**Note:** The previous command `bun --port 4321 --host=0.0.0.0 dist/index.html` was **incorrect** because:
- It tried to run an HTML file as a server
- Bun would just serve the single HTML file without assets or routing
- No proper handling of static assets in `_astro/` directory

---

## API Static File Serving

The API serves the web UI through these routes:

### Root Route (lines 106-118)
```typescript
.get('/', async () => {
  const indexUrl = new URL('../../web/dist/index.html', import.meta.url)
  const file = Bun.file(indexUrl)
  if (!(await file.exists())) {
    return new Response('index.html not found', { status: 404 })
  }
  const html = await file.text()
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
})
```

### Static Assets Route (lines 820-846)
```typescript
.get('/*', async ({ request }) => {
  const url = new URL(request.url)
  let pathname: string = url.pathname
  if (pathname === '/') pathname = '/index.html'
  const cleanPath: string = String(pathname).split('?')[0] || ''
  const ext = (cleanPath.split('.').pop() || '').toLowerCase()
  
  // Only serve css, js, html files
  if (!['css', 'js', 'html'].includes(ext)) {
    return new Response('Not Found', { status: 404 })
  }
  
  const distDir = new URL('../../web/dist/', import.meta.url)
  const fileUrl = new URL(cleanPath.replace(/^\//, ''), distDir)
  const file = Bun.file(fileUrl)
  
  if (!(await file.exists())) {
    return new Response('Not Found', { status: 404 })
  }
  
  // Set appropriate content-type headers
  const contentType = ext === 'css' ? 'text/css; charset=utf-8'
    : ext === 'js' ? 'application/javascript; charset=utf-8'
    : 'text/html; charset=utf-8'
    
  return new Response(file, { headers: { 'content-type': contentType } })
})
```

### Improvements Needed

To make the API a production-ready static file server, consider:

1. **Add cache headers:**
   ```typescript
   headers: { 
     'content-type': contentType,
     'cache-control': 'public, max-age=31536000, immutable' // for hashed assets
   }
   ```

2. **Support all asset types:**
   ```typescript
   const allowedExtensions = ['css', 'js', 'html', 'png', 'jpg', 'svg', 'webp', 'woff2', 'ico']
   ```

3. **Add compression:**
   ```typescript
   headers: {
     'content-encoding': 'gzip',
     // serve pre-compressed .gz files if available
   }
   ```

---

## Testing Locally

### Test Web Service
```bash
cd /workspace/apps/web
bun run build
bun run start
# Visit http://localhost:4321
```

### Test API Service (with UI)
```bash
cd /workspace
bun --cwd apps/web run build
bun --cwd apps/api run build
bun --cwd apps/api run start
# Visit http://localhost:3000 (or PORT env var)
```

### Test Both Services Separately
```bash
# Terminal 1 - API
cd /workspace/apps/api
bun run build && bun run start

# Terminal 2 - Web
cd /workspace/apps/web
bun run build && bun run start
```

---

## Railway Deployment

The current `railway.json` deploys both services separately. This is the **recommended approach** for now.

### Environment Variables to Set

**API Service:**
- `PORT=3000` (or Railway's assigned port)
- `HOST=::` (listen on all interfaces)
- `BITCOIN_NETWORK=mainnet` (or testnet/signet/regtest)
- `ALLOWED_ORIGINS=https://your-web-service.railway.app,https://your-api-service.railway.app`

**Web Service:**
- Automatically uses Railway's `PORT` assignment
- No additional env vars needed if API is CORS-configured

### Healthcheck Configuration

- **API**: Uses `/health` endpoint which returns auction counts and system status
- **Web**: Uses `/` which serves the homepage
- **Timeout**: Set to 300 seconds to allow for slower cold starts

---

## Troubleshooting

### Web service shows 404s for assets
- Ensure `bun run build` completed successfully
- Check that `dist/` directory exists with `_astro/` subdirectory
- Verify `start` command uses `astro preview` not `bun dist/index.html`

### API can't serve UI files
- Build web before API: `bun --cwd apps/web run build`
- Check relative path resolution in API code
- Verify `apps/web/dist/` exists relative to `apps/api/dist/index.js`

### CORS errors when web calls API
- Add web service URL to API's `ALLOWED_ORIGINS` environment variable
- Ensure both services are on same domain, or
- Use unified deployment strategy (API serves UI)

### Railway deployment fails healthcheck
- Check logs for startup errors
- Verify `PORT` environment variable is used correctly
- Increase `healthcheckTimeout` in `railway.json`
- Test endpoints manually: `curl https://your-service.railway.app/health`

---

## Recommendations

1. **Current Setup (Separate Services)**: Good for development and independent scaling
2. **Consider Unified Deployment**: When ready for production, migrate to API-served UI to reduce costs and complexity
3. **Add Cache Headers**: Improve performance by caching static assets
4. **Monitor Performance**: Use Railway metrics to determine if services need separate scaling

---

## Next Steps

- [ ] Test deployment preview on Railway
- [ ] Verify both `/` and `/auctions` routes work
- [ ] Check that static assets load correctly (CSS, JS)
- [ ] Validate API endpoints work under `/api/*` prefix
- [ ] Consider adding cache headers to API static file serving
- [ ] Add monitoring and error tracking