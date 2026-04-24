import { NextRequest, NextResponse } from "next/server";
import { runWorkerPass } from "@/lib/background-jobs";
import { runRetentionPass } from "@/lib/retention";

// FIX #15 — Wire retention into the cron job so old data is actually deleted.
// Previously lib/retention.ts existed but was never called from anywhere.
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }
  }

  const [processed, retained] = await Promise.all([
    runWorkerPass(10),
    runRetentionPass(),
  ]);

  return NextResponse.json({
    ok: true,
    processed,
    retentionDeleted: retained,
    ts: new Date().toISOString(),
  });
}
