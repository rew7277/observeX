import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { buildMetrics, parseLogs, type LogRecord } from "@/lib/log-parser";
import { buildSignature, detectSensitiveData, hashValue, maskSensitiveText } from "@/lib/security";

const INSERT_BATCH_SIZE = 500;

function toDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function toInputJson(value: Record<string, unknown> | null | undefined): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value == null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

export async function ingestUpload(params: {
  workspaceId: string;
  uploadId: string;
  content: string;
  environmentHint?: string;
}) {
  const { workspaceId, uploadId, content, environmentHint } = params;
  const parsed = parseLogs(content, { environmentHint });
  const records = parsed.records;

  const payload = records.map((record) => {
    const detection = detectSensitiveData(record.message);
    return {
      workspaceId,
      uploadId,
      timestamp: toDate(record.timestamp),
      level: record.level,
      application: record.application,
      environment: record.environment,
      traceId: record.traceId,
      latencyMs: Math.max(0, Math.round(record.latencyMs || 0)),
      message: maskSensitiveText(record.message),
      signature: buildSignature(record.message),
      containsPii: detection.containsPii,
      piiTypes: detection.piiTypes,
      payloadJson: toInputJson(record.payloadJson)
    };
  });

  for (let i = 0; i < payload.length; i += INSERT_BATCH_SIZE) {
    await db.logEvent.createMany({ data: payload.slice(i, i + INSERT_BATCH_SIZE) });
  }

  const metrics = buildMetrics(records);
  const maskedCount = payload.filter((item) => item.containsPii).length;
  const summary = {
    sourceType: parsed.sourceType,
    fingerprint: hashValue(content),
    metrics,
    parserHints: parsed.parserHints,
    quality: parsed.quality,
    advanced: {
      p95Latency: metrics.p95Latency,
      p99Latency: metrics.p99Latency,
      piiEvents: maskedCount,
      anomalySignals: metrics.anomalySignals,
      topSignatures: metrics.topSignatures
    }
  };

  return {
    parsed,
    summary,
    maskedCount,
    recordCount: records.length,
    fingerprint: hashValue(content)
  };
}
