# Deployment Checklist

## Pre-Deployment Tasks

- [x] Removed separate `web` service from `railway.json`
- [x] Updated API service to build from monorepo root
- [x] Changed web app to use relative API URLs
- [x] Added explicit `output: 'static'` to Astro config
- [x] Verified API serves static files from `apps/web/dist/`
- [x] Verified SPA fallback routing in API
- [x] Created deployment documentation

## Railway Dashboard Tasks

### 1. Remove Old Web Service (if exists)

1. Log into Railway dashboard
2. Navigate to your project
3. If you see a `web` service, delete it:
   - Click on the `web` service
   - Go to Settings
   - Scroll down and click "Delete Service"
   - Confirm deletion

### 2. Update API Service Configuration

1. Click on the `api` service
2. Go to "Settings" tab
3. Verify Environment Variables:
   - `AUCTION_ENCRYPTION_PASSWORD` - **REQUIRED** (set a strong password)
   - `BITCOIN_NETWORK` - Optional (testnet, mainnet, signet, regtest)
   - `LOG_LEVEL` - Optional (debug, info, warn, error)
   - `PORT` - Leave empty (Railway sets automatically)
   - `HOST` - Leave empty or set to `::`

### 3. Trigger Deployment

1. Push your changes to the git repository
2. Railway will automatically detect changes and rebuild
3. Monitor the build logs for any errors

## Post-Deployment Verification

### API Service URL
Find your service URL in Railway dashboard under the `api` service.

### Health Checks

1. **Root Path** - Should serve web UI:
   ```
   https://your-api-url.railway.app/
   ```
   Expected: HTML page loads

2. **API Health Endpoint**:
   ```
   https://your-api-url.railway.app/api/health
   ```
   Expected: JSON response with `{"ok": true, "data": {...}}`

3. **Auctions List**:
   ```
   https://your-api-url.railway.app/api/auctions
   ```
   Expected: JSON with auctions list

### Browser Testing

1. Open your service URL in a browser
2. Open Developer Tools (F12)
3. Check:
   - [ ] Page loads without errors
   - [ ] No CORS errors in Console
   - [ ] Network tab shows successful API calls to `/api/*`
   - [ ] Static assets load (check for 404s)
   - [ ] Navigation works (click through pages)

### Common Issues

#### Build Fails
- Check build logs in Railway
- Verify all dependencies are in package.json files
- Ensure bun.lock is committed to repository

#### 404 on Static Files
- Verify `bun run build` completed successfully
- Check that `apps/web/dist/` exists after build
- Review file paths in API's static serving code

#### API Calls Fail
- Check browser Network tab for request details
- Verify API routes are prefixed with `/api/`
- Review API logs in Railway dashboard
- Check CORS configuration if seeing cross-origin errors

#### Environment Variable Issues
- Verify `AUCTION_ENCRYPTION_PASSWORD` is set
- Check Railway environment variables are saved
- Redeploy after changing environment variables

## Rollback Plan

If deployment fails:

1. Revert changes to `railway.json`:
   ```json
   {
     "services": [
       {
         "name": "api",
         "rootDirectory": "apps/api",
         ...
       },
       {
         "name": "web",
         "rootDirectory": "apps/web",
         ...
       }
     ]
   }
   ```

2. Revert `apps/web/src/lib/auctions/apiAdapter.ts`:
   ```typescript
   const API_BASE = ((import.meta as any)?.env?.PUBLIC_API_BASE || 'http://localhost:3000') + '/api'
   ```

3. Set `PUBLIC_API_BASE` environment variable on web service to point to API

## Success Criteria

- ✅ Single API service running on Railway
- ✅ Web UI accessible at API service URL
- ✅ API endpoints respond correctly at `/api/*` routes
- ✅ No CORS errors
- ✅ Client-side routing works
- ✅ Static assets load correctly
- ✅ Health check endpoint returns 200 OK

## Support

For issues, check:
- Railway build logs
- Railway runtime logs
- Browser Developer Tools Console
- Browser Developer Tools Network tab
