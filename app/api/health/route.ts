import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// FIX #17 — Health check so Railway/Vercel knows the app is alive.
// A bad DB migration silently makes this return 503 rather than 200,
// surfacing the problem before users start complaining.
export async function GET() {
  const start = Date.now();
  let dbStatus = "ok";
  let dbLatencyMs = 0;

  try {
    await db.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - start;
  } catch (err) {
    dbStatus = "error";
    console.error("[health] DB check failed:", err);
    return NextResponse.json(
      {
        ok: false,
        db: "error",
        message: "Database connection failed",
        version: process.env.npm_package_version ?? "unknown",
        ts: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    db: dbStatus,
    dbLatencyMs,
    version: process.env.npm_package_version ?? "unknown",
    env: process.env.NODE_ENV,
    ts: new Date().toISOString(),
  });
}
