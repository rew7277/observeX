import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const body = await request.json().catch(() => ({}));
  const sourceId = String(body.sourceId || "");
  if (!sourceId) return NextResponse.json({ ok: false, message: "sourceId is required" }, { status: 400 });

  const source = await db.apiSource.findFirst({ where: { id: sourceId, workspaceId } });
  if (!source) return NextResponse.json({ ok: false, message: "Source not found" }, { status: 404 });

  await db.apiSource.update({
    where: { id: source.id },
    data: { lastTestedAt: new Date(), lastError: null, status: "active" },
  });

  await db.sourceRun.create({
    data: {
      workspaceId,
      apiSourceId: source.id,
      status: "active",
      recordsFetched: 0,
      recordsStored: 0,
      completedAt: new Date(),
      errorMessage: "Connectivity test stub passed. Wire your worker/cron runner to execute the real connector.",
    },
  });

  return NextResponse.json({ ok: true, message: "Source test recorded successfully." });
}
