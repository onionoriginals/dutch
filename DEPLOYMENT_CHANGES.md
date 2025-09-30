# Production Web Start Command and Hosting Strategy - Fixed

## Problem Summary

The `apps/web` service was using an incorrect start command:
```json
"start": "bun --port 4321 --host=0.0.0.0 dist/index.html"
```

This command doesn't work because:
1. Bun doesn't have built-in `--port` and `--host` flags for serving HTML files
2. Simply serving `dist/index.html` doesn't handle routing, assets, or proper MIME types
3. Railway deployment would fail to serve the Astro site correctly

## Solution Implemented

### 1. Fixed Web Service Start Command

**File:** `apps/web/package.json`

**Change:**
```json
"start": "astro preview --host 0.0.0.0 --port 4321"
```

**Benefits:**
- Uses Astro's built-in preview server
- Handles all routing (/, /auctions, etc.)
- Serves all assets with correct MIME types
- Supports SPA-style client-side navigation
- Works with Railway's health checks

### 2. Enhanced API Static File Serving (Fallback Option)

**File:** `apps/api/src/index.ts`

**Improvements:**
- Added support for all common file types (images, fonts, JSON, etc.)
- Implemented SPA fallback routing (non-existent routes serve index.html)
- Added proper cache headers:
  - `Cache-Control: public, max-age=31536000, immutable` for hashed assets (CSS, JS, fonts, images)
  - `Cache-Control: no-cache` for HTML files
- Better error handling and logging

**Supported file types:**
- Web: `html`, `css`, `js`, `json`
- Images: `svg`, `png`, `jpg`, `jpeg`, `gif`, `webp`, `ico`
- Fonts: `woff`, `woff2`, `ttf`, `eot`

## Deployment Strategy

### Option A: Separate Services (Current Configuration - Recommended)

**Configuration:** Keep both services in `railway.json`

- **Web Service**: Port 4321, runs `astro preview`
- **API Service**: Port 3000, serves API + can serve web as fallback

**Advantages:**
- Clear separation of concerns
- Web service can be scaled independently
- API service remains lightweight
- Better for microservices architecture

### Option B: Single Service (API serves everything)

**Configuration:** Remove web service from `railway.json`, update web URLs to point to API

**Advantages:**
- Single deployment
- Lower cost (one service)
- API already has full static file serving capability

**To switch to Option B:**
1. Remove the "web" service from `railway.json`
2. Update frontend API calls to use relative URLs or same origin
3. Ensure CORS allows the API's domain
4. Point Railway domains to API service only

## Testing

### Local Testing

```bash
# Test web service
cd apps/web
bun install
bun run build
bun run start
# Visit http://localhost:4321 and http://localhost:4321/auctions

# Test API serving static files
cd apps/api
bun run build
bun run start
# Visit http://localhost:3000 and http://localhost:3000/auctions
```

### Railway Deployment Testing

1. Push changes to repository
2. Railway will automatically deploy both services
3. Check healthcheck paths:
   - Web: `https://web-service.railway.app/`
   - API: `https://api-service.railway.app/`
4. Verify routes work:
   - `/` (home page)
   - `/auctions` (auction listing)
   - Static assets (CSS, JS, images)

## Railway Configuration

Current `railway.json` is correct and requires no changes:

```json
{
  "services": [
    {
      "name": "web",
      "rootDirectory": "apps/web",
      "build": {
        "installCommand": "bun install --frozen-lockfile",
        "buildCommand": "bun run build"
      },
      "startCommand": "bun run start",
      "healthcheckPath": "/"
    }
  ]
}
```

The `startCommand` now correctly runs `astro preview` via the fixed package.json.

## Acceptance Criteria ✅

- [x] **Fixed web start command**: Changed to `astro preview --host 0.0.0.0 --port 4321`
- [x] **Enhanced API static serving**: Added all file types and proper cache headers
- [x] **SPA routing support**: Both API and Astro preview support client-side routing
- [x] **Cache headers configured**: Proper caching for performance
- [x] **Railway compatibility**: Both services work with Railway's NIXPACKS builder
- [x] **Healthcheck support**: Both services respond correctly to `/` healthcheck

## Migration Notes

### Breaking Changes
None - this is a fix for a broken configuration.

### Environment Variables
No new environment variables required.

### Database Changes
None.

## Rollback Plan

If issues occur, revert the following files:
1. `apps/web/package.json` - Revert start command
2. `apps/api/src/index.ts` - Revert static file serving changes (lines 820-897)

## Additional Recommendations

1. **Consider adding a static file CDN** for production (Cloudflare, CloudFront) for better performance
2. **Add monitoring** for both services to detect serving issues
3. **Set up proper logging** for static file requests to debug any missing assets
4. **Configure custom domains** in Railway for both services
5. **Add E2E tests** to verify deployment works correctly after each push

## Related Files Modified

- `apps/web/package.json` - Fixed start command
- `apps/api/src/index.ts` - Enhanced static file serving with cache headers
- `DEPLOYMENT_CHANGES.md` - This documentation (new file)