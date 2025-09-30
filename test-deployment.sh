#!/bin/bash
set -e

echo "=== Deployment Test Suite ==="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test 1: Build web app
echo -e "${BLUE}[1/5] Building web app...${NC}"
cd /workspace/apps/web
bun run build
if [ -d "dist" ] && [ -f "dist/index.html" ]; then
  echo -e "${GREEN}✓ Web build successful${NC}"
else
  echo -e "${RED}✗ Web build failed - dist/index.html not found${NC}"
  exit 1
fi

# Test 2: Build API
echo -e "${BLUE}[2/5] Building API...${NC}"
cd /workspace/apps/api
bun run build
if [ -f "dist/index.js" ]; then
  echo -e "${GREEN}✓ API build successful${NC}"
else
  echo -e "${RED}✗ API build failed - dist/index.js not found${NC}"
  exit 1
fi

# Test 3: Test web preview server
echo -e "${BLUE}[3/5] Testing web preview server...${NC}"
cd /workspace/apps/web
timeout 3 bun run start > /tmp/web-test.log 2>&1 &
WEB_PID=$!
sleep 2

if curl -s http://localhost:4321 | grep -q "<!DOCTYPE html>"; then
  echo -e "${GREEN}✓ Web server serves HTML correctly${NC}"
else
  echo -e "${RED}✗ Web server test failed${NC}"
  cat /tmp/web-test.log
  kill $WEB_PID 2>/dev/null || true
  exit 1
fi

# Check for CSS asset
if curl -s http://localhost:4321/_astro/index.bkPIfBhf.css | grep -q ".*{"; then
  echo -e "${GREEN}✓ Web server serves CSS assets${NC}"
else
  echo -e "${RED}⚠ Warning: CSS asset not found (may be normal)${NC}"
fi

kill $WEB_PID 2>/dev/null || true
sleep 1

# Test 4: Test API with UI serving
echo -e "${BLUE}[4/5] Testing API with UI serving...${NC}"
cd /workspace/apps/api
PORT=3000 timeout 3 bun run start > /tmp/api-test.log 2>&1 &
API_PID=$!
sleep 2

if curl -s http://localhost:3000 | grep -q "<!DOCTYPE html>"; then
  echo -e "${GREEN}✓ API serves UI HTML correctly${NC}"
else
  echo -e "${RED}✗ API UI serving test failed${NC}"
  cat /tmp/api-test.log
  kill $API_PID 2>/dev/null || true
  exit 1
fi

# Check health endpoint
if curl -s http://localhost:3000/health | grep -q '"ok":true'; then
  echo -e "${GREEN}✓ API health endpoint works${NC}"
else
  echo -e "${RED}✗ API health endpoint test failed${NC}"
  kill $API_PID 2>/dev/null || true
  exit 1
fi

kill $API_PID 2>/dev/null || true
sleep 1

# Test 5: Verify Railway configuration
echo -e "${BLUE}[5/5] Verifying Railway configuration...${NC}"
cd /workspace

if [ -f "railway.json" ]; then
  if grep -q '"startCommand": "bun run start"' railway.json; then
    echo -e "${GREEN}✓ Railway start commands configured${NC}"
  else
    echo -e "${RED}✗ Railway start commands incorrect${NC}"
    exit 1
  fi
  
  if grep -q '"healthcheckPath": "/health"' railway.json; then
    echo -e "${GREEN}✓ Railway healthcheck paths configured${NC}"
  else
    echo -e "${RED}✗ Railway healthcheck paths incorrect${NC}"
    exit 1
  fi
else
  echo -e "${RED}✗ railway.json not found${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== All deployment tests passed! ===${NC}"
echo ""
echo "Next steps:"
echo "  1. Commit changes: git add -A && git commit -m 'Fix production web start command'"
echo "  2. Push to Railway: git push"
echo "  3. Monitor deployment in Railway dashboard"
echo "  4. Test live URLs:"
echo "     - Web: https://your-web-service.railway.app/"
echo "     - API: https://your-api-service.railway.app/health"
echo ""
echo "Deployment strategies available:"
echo "  • Current: Separate web and API services"
echo "  • Alternative: API serves UI (see DEPLOYMENT.md)"