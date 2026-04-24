import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashValue, safeCompare } from "@/lib/security";
import { ingestWebhookEvents, type WebhookEvent } from "@/lib/ingestion";

async function authenticateApiKey(request: NextRequest, workspaceId: string) {
  const authHeader = request.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return { ok: false as const, status: 401, message: "Missing Bearer token" };

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return { ok: false as const, status: 401, message: "Empty Bearer token" };

  const prefix = rawKey.slice(0, 7);
  const apiKeys = await db.apiKey.findMany({ where: { workspaceId, keyPrefix: prefix } });
  const hashed = hashValue(rawKey);
  const matched = apiKeys.find((k) => safeCompare(k.secretHash, hashed));

  if (!matched) return { ok: false as const, status: 401, message: "Invalid API key" };

  // Update lastUsedAt async — don't block response
  void db.apiKey.update({ where: { id: matched.id }, data: { lastUsedAt: new Date() } });

  return { ok: true as const, keyId: matched.id };
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown> | null = null;
  try { body = await request.json(); } catch { /* fall through */ }

  if (!body?.workspaceId || !body?.events || !Array.isArray(body.events)) {
    return NextResponse.json({ ok: false, message: "workspaceId and events[] are required" }, { status: 400 });
  }

  const workspaceId = String(body.workspaceId);

  // ✅ Authenticate the caller
  const auth = await authenticateApiKey(request, workspaceId);
  if (!auth.ok) return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) return NextResponse.json({ ok: false, message: "Workspace not found" }, { status: 404 });

  const stored = await ingestWebhookEvents(workspaceId, body.events as WebhookEvent[]);

  return NextResponse.json({ ok: true, stored }, {
    headers: { "X-RateLimit-Limit": "500", "X-RateLimit-Remaining": String(Math.max(0, 500 - stored)) },
  });
}
