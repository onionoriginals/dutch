# Deployment Checklist

Use this checklist to verify the deployment after pushing to Railway.

## Pre-Deployment ✅

- [x] Fixed web service start command in `apps/web/package.json`
- [x] Enhanced API static file serving in `apps/api/src/index.ts`
- [x] Verified Railway config is correct (`railway.json`)
- [x] Documentation created
- [x] Changes committed to repository

## Deployment Steps

### 1. Push to Repository
```bash
git add apps/web/package.json apps/api/src/index.ts
git commit -m "fix: correct production web start command and enhance static serving"
git push origin main
```

### 2. Monitor Railway Deployment

**API Service:**
- [ ] Build starts automatically
- [ ] `bun install --frozen-lockfile` completes
- [ ] `bun run build` completes successfully
- [ ] Service starts with `bun run start`
- [ ] Health check passes at `/`
- [ ] No errors in logs

**Web Service:**
- [ ] Build starts automatically
- [ ] `bun install --frozen-lockfile` completes
- [ ] `bun run build` completes successfully
- [ ] Service starts with `astro preview`
- [ ] Health check passes at `/`
- [ ] No errors in logs

### 3. Verify Endpoints

**Web Service (Port 4321):**
- [ ] `GET /` returns HTML (homepage)
- [ ] `GET /auctions` returns HTML (auctions page)
- [ ] `GET /_astro/*.css` returns CSS with correct content-type
- [ ] `GET /_astro/*.js` returns JS with correct content-type
- [ ] No 404 errors in browser console

**API Service (Port 3000):**
- [ ] `GET /hello` returns JSON
- [ ] `GET /health` returns JSON with status
- [ ] `GET /api/auctions` returns JSON auction data
- [ ] `GET /auctions` returns JSON auction data
- [ ] Static fallback works (if web service is down)

### 4. Test Key User Flows

#### Homepage Load
- [ ] Visit homepage URL
- [ ] Page loads within 3 seconds
- [ ] CSS styles applied
- [ ] No console errors
- [ ] Navigation works

#### Auctions Page Load
- [ ] Visit `/auctions` directly
- [ ] Page loads successfully
- [ ] Auctions display (or empty state shows)
- [ ] API calls complete successfully
- [ ] No console errors

#### API Integration
- [ ] Open browser DevTools → Network tab
- [ ] Refresh `/auctions` page
- [ ] Verify API calls to `/api/auctions`
- [ ] Verify successful responses (200 status)
- [ ] Verify JSON data structure

### 5. Performance Checks

**Cache Headers:**
- [ ] Static assets have `cache-control: public, max-age=31536000, immutable`
- [ ] HTML files have `cache-control: no-cache`
- [ ] Check in DevTools → Network → Headers

**Load Times (via DevTools → Network):**
- [ ] First load: < 3 seconds
- [ ] Cached load: < 1 second
- [ ] LCP (Largest Contentful Paint): < 2.5s
- [ ] No large unoptimized images

**Browser Console:**
- [ ] No 404 errors
- [ ] No CORS errors
- [ ] No JavaScript errors

### 6. Cross-Browser Testing

Test in multiple browsers:
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (if available)

### 7. Mobile Testing

- [ ] Responsive design works
- [ ] Touch interactions work
- [ ] Performance acceptable on mobile network

## Post-Deployment

### Monitoring Setup
- [ ] Set up error tracking (Sentry, LogRocket, etc.)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom, etc.)
- [ ] Configure alerts for downtime
- [ ] Set up performance monitoring

### Documentation
- [ ] Update deployment documentation with URLs
- [ ] Share deployment status with team
- [ ] Document any issues encountered

### Backup Plan
- [ ] Note current deployment commit SHA
- [ ] Document rollback procedure if needed
- [ ] Keep Railway dashboard open for quick rollback

## Common Issues & Solutions

### Issue: Web service health check fails

**Symptoms:**
- Railway shows "unhealthy"
- Service keeps restarting

**Solution:**
1. Check Railway logs for errors
2. Verify `astro preview` command works locally
3. Ensure port 4321 is correct
4. Check if dependencies installed correctly

**Rollback:**
```bash
git revert HEAD
git push origin main
```

### Issue: Assets return 404

**Symptoms:**
- Page loads but unstyled
- Console shows 404 for CSS/JS files

**Solution:**
1. Check `bun run build` completed successfully
2. Verify `dist/` folder contains `_astro/` directory
3. Check file paths in HTML source
4. Verify Railway build logs

### Issue: API calls fail with CORS errors

**Symptoms:**
- Browser console shows CORS errors
- API calls blocked

**Solution:**
1. Check `ALLOWED_ORIGINS` environment variable
2. Verify CORS configuration in `apps/api/src/index.ts`
3. Add web service URL to allowed origins
4. Restart API service

### Issue: Routing doesn't work (404 on refresh)

**Symptoms:**
- Works when navigating from home
- 404 when refreshing on `/auctions`

**Solution:**
- This should be fixed by our changes
- Verify `astro preview` is running (not static file server)
- Check API SPA fallback is working

## Rollback Procedure

If critical issues occur:

### Quick Rollback (Railway Dashboard)
1. Go to Railway dashboard
2. Select the service
3. Click "Deployments"
4. Click "Rollback" on previous working deployment

### Git Rollback
```bash
# Revert the commit
git revert HEAD

# Or reset to previous commit
git reset --hard HEAD~1

# Force push (be careful!)
git push origin main --force
```

### Manual Fix
```bash
# Restore previous version of files
git checkout HEAD~1 apps/web/package.json
git checkout HEAD~1 apps/api/src/index.ts
git commit -m "revert: rollback web start command changes"
git push origin main
```

## Success Criteria

Deployment is successful when:

✅ All services healthy in Railway dashboard
✅ Homepage loads correctly with styles
✅ Auctions page loads correctly with styles
✅ API endpoints return correct data
✅ No console errors
✅ No 404 errors for assets
✅ Cache headers present
✅ Load time < 3 seconds

## Sign-Off

- [ ] All checks passed
- [ ] Deployment verified in production
- [ ] Team notified of successful deployment
- [ ] Monitoring set up and active
- [ ] Documentation updated

**Deployed by:** _______________
**Date:** _______________
**Deployment ID:** _______________
**Notes:** _______________

---

## Quick Reference

### Railway URLs (Update after deployment)
- **Web Service:** https://________.railway.app
- **API Service:** https://________.railway.app

### Key Endpoints to Test
- Web: `/`, `/auctions`, `/auction`, `/auctions/new`
- API: `/hello`, `/health`, `/api/auctions`, `/auctions`

### Support Contacts
- **Primary:** _______________
- **Secondary:** _______________
- **Emergency:** _______________

---

*Last updated: 2025-09-30*