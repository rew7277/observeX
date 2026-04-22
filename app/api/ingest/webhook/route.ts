import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildSignature, detectSensitiveData, maskSensitiveText } from "@/lib/security";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as any;
  if (!body?.workspaceId || !body?.events || !Array.isArray(body.events)) {
    return NextResponse.json({ ok: false, message: "workspaceId and events[] are required" }, { status: 400 });
  }

  const rows = body.events.slice(0, 500).map((event: any) => {
    const message = String(event.message || "");
    const pii = detectSensitiveData(message);
    return {
      workspaceId: String(body.workspaceId),
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      level: String(event.level || "INFO"),
      application: String(event.application || "webhook"),
      environment: String(event.environment || "unknown"),
      traceId: String(event.traceId || `webhook-${Date.now()}`),
      latencyMs: Number(event.latencyMs || 0),
      message: maskSensitiveText(message),
      signature: buildSignature(message),
      containsPii: pii.containsPii,
      piiTypes: pii.piiTypes,
      payloadJson: event,
    };
  });

  await db.logEvent.createMany({ data: rows });
  return NextResponse.json({ ok: true, stored: rows.length });
}
