import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildMetrics, parseLogs, type LogRecord } from "@/lib/log-parser";
import { buildSignature, detectSensitiveData, hashValue, maskSensitiveText } from "@/lib/security";

const INSERT_BATCH_SIZE = 500;

function toDate(value: string): Date {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toInputJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function ingestUpload(params: { workspaceId: string; uploadId: string; content: string; environmentHint?: string }) {
  const { workspaceId, uploadId, content, environmentHint } = params;
  const parsed = parseLogs(content, { environmentHint });
  const records = parsed.records;

  const payload = records.map((record: LogRecord) => {
    const detection = detectSensitiveData(record.message);
    return {
      workspaceId, uploadId,
      timestamp: toDate(record.timestamp),
      level: record.level, application: record.application,
      environment: record.environment, traceId: record.traceId,
      latencyMs: Math.max(0, Math.round(record.latencyMs || 0)),
      message: maskSensitiveText(record.message),
      signature: buildSignature(record.message),
      containsPii: detection.containsPii, piiTypes: detection.piiTypes,
      payloadJson: toInputJson(record.payloadJson),
    };
  });

  // ✅ Transactional batch insert — rollback on failure
  await db.$transaction(async (tx) => {
    for (let i = 0; i < payload.length; i += INSERT_BATCH_SIZE) {
      await tx.logEvent.createMany({ data: payload.slice(i, i + INSERT_BATCH_SIZE), skipDuplicates: true });
    }
  });

  const metrics = buildMetrics(records);
  const maskedCount = payload.filter((item) => item.containsPii).length;
  const fingerprint = hashValue(content);
  const summary = { sourceType: parsed.sourceType, fingerprint, metrics, parserHints: parsed.parserHints, quality: parsed.quality };

  return { parsed, summary, maskedCount, recordCount: records.length, fingerprint };
}

export type WebhookEvent = { timestamp?: string; level?: string; application?: string; environment?: string; traceId?: string; latencyMs?: number; message: string; [key: string]: unknown };

export async function ingestWebhookEvents(workspaceId: string, events: WebhookEvent[]) {
  const rows = events.slice(0, 500).map((event) => {
    const message = String(event.message || "");
    const pii = detectSensitiveData(message);
    return {
      workspaceId,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      level: String(event.level || "INFO").toUpperCase(),
      application: String(event.application || "webhook"),
      environment: String(event.environment || "unknown"),
      traceId: String(event.traceId || `wh-${Date.now()}`),
      latencyMs: Math.max(0, Number(event.latencyMs || 0)),
      message: maskSensitiveText(message),
      signature: buildSignature(message),
      containsPii: pii.containsPii, piiTypes: pii.piiTypes,
      payloadJson: toInputJson(event as Record<string, unknown>),
    };
  });
  await db.logEvent.createMany({ data: rows, skipDuplicates: true });
  return rows.length;
}
