const DEFAULT_PORT = 4321;
const HOSTNAME = process.env.HOST || "::";
const PORT = Number(process.env.PORT || DEFAULT_PORT);
const DIST_DIR = "dist";

// Prefer internal networking on Railway. Falls back to local dev.
const API_INTERNAL_ORIGIN =
  process.env.API_INTERNAL_ORIGIN ||
  (process.env.RAILWAY_PRIVATE_NETWORK || process.env.RAILWAY || process.env.RAILWAY_ENVIRONMENT
    ? "http://api.railway.internal"
    : "http://127.0.0.1:3000");

function isLikelyHashedAsset(pathname: string): boolean {
  if (pathname.includes("/_astro/")) return true;
  if (pathname.includes("/assets/")) return true;
  return /\.[a-f0-9]{8,}\./.test(pathname);
}

function sanitizePath(pathname: string): string {
  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // ignore decode errors; keep raw pathname
  }
  // prevent path traversal
  pathname = pathname.replace(/\\/g, "/");
  while (pathname.includes("..")) pathname = pathname.replace("..", ".");
  if (pathname.endsWith("/")) pathname += "index.html";
  if (pathname === "") pathname = "/index.html";
  return pathname;
}

async function getFileResponse(pathname: string): Promise<Response | null> {
  const filePath = `${DIST_DIR}${pathname}`;
  const file = Bun.file(filePath);
  if (await file.exists()) {
    const headers = new Headers();
    if (isLikelyHashedAsset(pathname)) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      headers.set("Cache-Control", "public, max-age=600");
    }
    return new Response(file, { headers });
  }
  return null;
}

Bun.serve({
  hostname: HOSTNAME,
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    let pathname = sanitizePath(url.pathname);

    // Reverse proxy: forward /api/* to the API service
    if (url.pathname.startsWith("/api")) {
      const apiPath = url.pathname.replace(/^\/api/, "") || "/";
      const targetUrl = new URL(API_INTERNAL_ORIGIN);
      targetUrl.pathname = apiPath;
      targetUrl.search = url.search;

      const headers = new Headers(req.headers);
      headers.delete("host");
      headers.delete("connection");
      headers.delete("transfer-encoding");

      const init: RequestInit = {
        method: req.method,
        headers,
      };
      if (req.method !== "GET" && req.method !== "HEAD") {
        init.body = req.body as any;
      }

      const apiResponse = await fetch(targetUrl.toString(), init as any);
      // Return response as-is (streaming body)
      return new Response(apiResponse.body, {
        status: apiResponse.status,
        headers: apiResponse.headers,
      });
    }

    // Try the exact file first
    const direct = await getFileResponse(pathname);
    if (direct) return direct;

    // If the path doesn't look like a file (no extension), serve SPA fallback
    if (!/\.[a-zA-Z0-9]+$/.test(pathname)) {
      const fallback = await getFileResponse("/index.html");
      if (fallback) return fallback;
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Static server running at http://${HOSTNAME}:${PORT}`);


