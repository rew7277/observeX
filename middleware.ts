import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// In-memory rate limiter (no Redis required — works on Railway/Vercel)
// Each entry: { count, resetAt }
// ---------------------------------------------------------------------------
const store = new Map<string, { count: number; resetAt: number }>();

// Clean up old entries every 5 minutes to avoid memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = store.get(key);
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + windowMs };
    store.set(key, entry);
  }
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  return { ok: entry.count <= limit, remaining, resetAt: entry.resetAt };
}

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Per-route limits
// ---------------------------------------------------------------------------
const LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/ingest/webhook":     { limit: 500,  windowMs: 60_000 },      // 500/min per IP
  "/app/actions/auth":       { limit: 10,   windowMs: 60_000 },      // 10/min login
  "auth:login":              { limit: 10,   windowMs: 15 * 60_000 }, // 10 per 15 min
  "auth:register":           { limit: 5,    windowMs: 60 * 60_000 }, // 5/hr
  "/api/invites":            { limit: 30,   windowMs: 60_000 },
  "/api/workspaces":         { limit: 120,  windowMs: 60_000 },
  "default":                 { limit: 300,  windowMs: 60_000 },
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getIp(request);

  // Only apply to API routes and server actions
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/app/")) {
    return NextResponse.next();
  }

  // Determine which limit bucket applies
  let bucketKey = "default";
  if (pathname === "/api/ingest/webhook") bucketKey = "/api/ingest/webhook";
  else if (pathname === "/api/invites")   bucketKey = "/api/invites";
  else if (pathname.startsWith("/api/workspaces")) bucketKey = "/api/workspaces";
  // Auth server actions go through Next.js route — handled by action-level guards

  const { limit, windowMs } = LIMITS[bucketKey] ?? LIMITS["default"];
  const rl = rateLimit(`${ip}:${bucketKey}`, limit, windowMs);

  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(limit));
  headers.set("X-RateLimit-Remaining", String(rl.remaining));
  headers.set("X-RateLimit-Reset", String(Math.ceil(rl.resetAt / 1000)));

  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, message: "Too many requests — slow down and try again shortly." },
      { status: 429, headers }
    );
  }

  const response = NextResponse.next();
  headers.forEach((v, k) => response.headers.set(k, v));
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
