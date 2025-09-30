# Quick Deployment Guide

## Changes Made

### 1. Fixed Web Service Start Command
**File:** `apps/web/package.json`

**Before:**
```json
"start": "bun --port 4321 --host=0.0.0.0 dist/index.html"
```

**After:**
```json
"start": "astro preview --host 0.0.0.0 --port 4321"
```

### 2. Enhanced API Static File Serving
**File:** `apps/api/src/index.ts` (lines 820-897)

- Added support for all web asset types (images, fonts, JSON, etc.)
- Implemented SPA fallback routing
- Added cache headers for optimal performance

## Deployment Flow

### Railway Deployment (Automatic)

1. Push changes to your repository
2. Railway automatically triggers:
   ```bash
   # For API service (apps/api):
   bun install --frozen-lockfile
   bun run build  # Compiles to dist/index.js
   bun run start  # Runs: bun dist/index.js
   
   # For Web service (apps/web):
   bun install --frozen-lockfile
   bun run build  # Builds Astro site to dist/
   bun run start  # Runs: astro preview --host 0.0.0.0 --port 4321
   ```
3. Services are live!

### Manual Local Testing

```bash
# Terminal 1 - API Service
cd apps/api
bun install
bun run build
bun run start
# API available at http://localhost:3000
# Also serves web UI as fallback

# Terminal 2 - Web Service
cd apps/web
bun install
bun run build
bun run start
# Web UI available at http://localhost:4321
```

### Verify Deployment

1. **Check Health:**
   - Web: `https://your-web-service.railway.app/`
   - API: `https://your-api-service.railway.app/`

2. **Test Routes:**
   - `/` - Home page
   - `/auctions` - Auction listing page
   - `/api/auctions` - API endpoint

3. **Verify Assets:**
   - CSS loads (no 404s in DevTools)
   - JavaScript loads
   - Images load
   - Fonts load

## Architecture

### Current Setup (Recommended)

```
┌─────────────────────────────────────────┐
│           Railway Services              │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │ Web Service  │    │ API Service  │  │
│  │              │    │              │  │
│  │ Port: 4321   │    │ Port: 3000   │  │
│  │              │    │              │  │
│  │ Astro        │◄───┤ Elysia API   │  │
│  │ Preview      │    │              │  │
│  │ Server       │    │ + Static     │  │
│  │              │    │   Fallback   │  │
│  └──────────────┘    └──────────────┘  │
│         │                   │           │
└─────────┼───────────────────┼───────────┘
          │                   │
          ▼                   ▼
      End Users         API Consumers
```

### Alternative: Single Service (API Only)

If you want to simplify:

1. Remove `web` service from `railway.json`
2. Use API service to serve everything
3. Update frontend to use API's origin

## Troubleshooting

### Issue: Web service shows 404s

**Solution:** Ensure build completed successfully
```bash
cd apps/web
bun run build
ls -la dist/  # Should contain index.html and _astro/ folder
```

### Issue: Assets not loading

**Solution:** Check cache headers and MIME types in browser DevTools Network tab

### Issue: API routes return 404

**Solution:** Verify `/api/*` routes are working:
```bash
curl https://your-api-service.railway.app/api/auctions
```

### Issue: Health check fails

**Solution:** Both services respond to `/`:
```bash
curl https://your-web-service.railway.app/
curl https://your-api-service.railway.app/
```

## Performance Tips

1. **Enable CDN:** Consider adding Cloudflare or CloudFront in front
2. **Optimize Images:** Use WebP format and optimize sizes
3. **Bundle Splitting:** Astro already does this, but verify chunks are reasonable
4. **Monitoring:** Add logging for slow requests

## Security Checklist

- [x] CORS configured in API (already done)
- [ ] HTTPS enforced in Railway (configure in dashboard)
- [ ] Rate limiting considered (add if needed)
- [ ] API authentication for sensitive endpoints (add if needed)

## Next Steps

1. **Deploy to Railway** - Push this branch
2. **Monitor Logs** - Check Railway logs for both services
3. **Test All Routes** - Visit key pages and API endpoints
4. **Set Custom Domains** - Configure in Railway dashboard
5. **Add Monitoring** - Consider Sentry, LogRocket, or similar

## Files Modified

- ✅ `apps/web/package.json` - Fixed start command
- ✅ `apps/api/src/index.ts` - Enhanced static serving
- ✅ `DEPLOYMENT_CHANGES.md` - Detailed documentation
- ✅ `QUICK_DEPLOYMENT_GUIDE.md` - This guide

## No Changes Needed

- ✅ `railway.json` - Already correct
- ✅ `astro.config.mjs` - Already correct
- ✅ `apps/api/package.json` - Already correct

---

**Status:** ✅ Ready to deploy
**Risk Level:** Low (fixes broken configuration)
**Rollback:** Simple (revert 2 files)