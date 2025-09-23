const DEFAULT_PORT = 4321;
const HOSTNAME = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || DEFAULT_PORT);
const DIST_DIR = "dist";

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


