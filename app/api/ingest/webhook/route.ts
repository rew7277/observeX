import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashValue, safeCompare } from "@/lib/security";
import { ingestWebhookEvents, type WebhookEvent } from "@/lib/ingestion";

// ---------------------------------------------------------------------------
// API key authentication middleware
// ---------------------------------------------------------------------------

async function authenticateApiKey(
  request: NextRequest,
  workspaceId: string
): Promise<{ ok: true; keyId: string } | { ok: false; status: number; message: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, message: "Missing Bearer token" };
  }

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) {
    return { ok: false, status: 401, message: "Empty Bearer token" };
  }

  // API keys are stored as keyPrefix + secretHash.
  // The incoming raw key format is: ovx_<24-byte-hex>
  const prefix = rawKey.slice(0, 7); // e.g. "ovx_abc"

  const apiKeys = await db.apiKey.findMany({
    where: { workspaceId, keyPrefix: prefix },
  });

  const hashed = hashValue(rawKey);
  const matched = apiKeys.find((k) => safeCompare(k.secretHash, hashed));

  if (!matched) {
    return { ok: false, status: 401, message: "Invalid API key" };
  }

  // Update last-used timestamp asynchronously (don't block the response)
  void db.apiKey.update({
    where: { id: matched.id },
    data: { lastUsedAt: new Date() },
  });

  return { ok: true, keyId: matched.id };
}

// ---------------------------------------------------------------------------
// POST /api/ingest/webhook
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;

  if (!body?.workspaceId || !body?.events || !Array.isArray(body.events)) {
    return NextResponse.json(
      { ok: false, message: "workspaceId and events[] are required" },
      { status: 400 }
    );
  }

  const workspaceId = String(body.workspaceId);

  // ✅ Verify the caller owns this workspace
  const auth = await authenticateApiKey(request, workspaceId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  // Confirm workspace exists
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true },
  });
  if (!workspace) {
    return NextResponse.json({ ok: false, message: "Workspace not found" }, { status: 404 });
  }

  const stored = await ingestWebhookEvents(workspaceId, body.events as WebhookEvent[]);

  return NextResponse.json(
    { ok: true, stored },
    {
      headers: {
        // Basic rate-limit hint for clients (enforcement must be at edge/middleware layer)
        "X-RateLimit-Limit": "500",
        "X-RateLimit-Remaining": String(Math.max(0, 500 - stored)),
      },
    }
  );
}
