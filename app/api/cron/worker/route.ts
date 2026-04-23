import { NextRequest, NextResponse } from "next/server";
import { runWorkerPass } from "@/lib/background-jobs";

/**
 * GET /api/cron/worker
 *
 * Called by your scheduler (Railway cron, Vercel cron, GitHub Actions, etc.)
 * to process queued uploads outside the HTTP request lifecycle.
 *
 * Protect with CRON_SECRET environment variable so only the scheduler can
 * trigger it:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Railway cron config (railway.json):
 *   "cronJobs": [{ "schedule": "* * * * *", "command": "curl -H 'Authorization: Bearer $CRON_SECRET' $RAILWAY_PUBLIC_DOMAIN/api/cron/worker" }]
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const processed = await runWorkerPass(10);

  return NextResponse.json({
    ok: true,
    processed,
    ts: new Date().toISOString(),
  });
}
