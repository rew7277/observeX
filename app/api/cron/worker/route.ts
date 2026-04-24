import { NextRequest, NextResponse } from "next/server";
import { runWorkerPass } from "@/lib/background-jobs";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${cronSecret}`) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const processed = await runWorkerPass(10);
  return NextResponse.json({ ok: true, processed, ts: new Date().toISOString() });
}
