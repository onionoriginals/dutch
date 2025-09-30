# Quick Start - Production Deployment

## ⚡ TL;DR - What Changed

**Old (Broken):**
```json
"start": "bun --port 4321 --host=0.0.0.0 dist/index.html"  // ❌ Wrong
```

**New (Fixed):**
```json
"start": "astro preview --host 0.0.0.0 --port 4321"  // ✅ Correct
```

## 🚀 Deploy to Railway

```bash
# 1. Test locally first
./test-deployment.sh

# 2. Commit and push
git add -A
git commit -m "Fix production web start command"
git push origin main

# 3. Railway auto-deploys both services
# - Web: https://your-web-service.railway.app
# - API: https://your-api-service.railway.app
```

## 🧪 Test Locally

### Build Everything
```bash
cd /workspace
bun install
bun --cwd apps/web run build
bun --cwd apps/api run build
```

### Test Web Service (Separate)
```bash
cd /workspace/apps/web
bun run start
# Open http://localhost:4321
```

### Test API Service (With UI)
```bash
cd /workspace/apps/api
bun run start
# Open http://localhost:3000
```

### Test Both Together
```bash
# Terminal 1
cd /workspace/apps/api && bun run start

# Terminal 2
cd /workspace/apps/web && bun run start
```

## ✅ Verify Deployment

```bash
# Check web service
curl https://your-web-service.railway.app/
curl https://your-web-service.railway.app/auctions

# Check API service
curl https://your-api-service.railway.app/health
curl https://your-api-service.railway.app/api/auctions
```

## 📋 What to Check

- [ ] Homepage loads (`/`)
- [ ] Auctions page loads (`/auctions`)
- [ ] CSS and JS assets load (check browser DevTools)
- [ ] API `/health` returns `{"ok":true}`
- [ ] API `/api/auctions` returns auction data
- [ ] No CORS errors in browser console

## 🆘 Troubleshooting

### Web service shows blank page
```bash
# Check Railway logs for errors
# Verify build completed: dist/index.html exists
cd /workspace/apps/web && ls -la dist/
```

### API healthcheck failing
```bash
# Increase timeout in railway.json (already set to 300s)
# Check API logs for startup errors
# Test locally: curl http://localhost:3000/health
```

### Assets return 404
```bash
# Rebuild web:
cd /workspace/apps/web && bun run build

# Verify _astro directory exists:
ls -la dist/_astro/
```

### CORS errors
```bash
# Add web URL to API ALLOWED_ORIGINS env var:
ALLOWED_ORIGINS=https://your-web-service.railway.app
```

## 📚 More Info

- **Full deployment guide:** `DEPLOYMENT.md`
- **Change summary:** `CHANGES_SUMMARY.md`
- **Test suite:** `./test-deployment.sh`

## 🎯 Two Deployment Options

### Option 1: Separate Services (Current)
- Web service runs Astro preview
- API service runs Elysia
- Configure CORS between them
- **Best for:** Development, independent scaling

### Option 2: Unified Service (Alternative)
- API serves both UI and API
- No CORS needed
- Single service to manage
- **Best for:** Production, lower cost

See `DEPLOYMENT.md` for migration guide.

---

## 🔧 Commands Cheatsheet

```bash
# Install dependencies
bun install

# Dev mode (both services)
bun run dev

# Dev mode (individual)
bun run dev:web
bun run dev:api

# Build (both)
bun run build

# Production start (individual)
bun --cwd apps/web run start
bun --cwd apps/api run start

# Test deployment
./test-deployment.sh

# Clean install
bun run clean && bun install
```

---

**Status:** ✅ Ready to Deploy
**Tested:** ✅ All tests passing
**Impact:** Fixes Railway deployment failures