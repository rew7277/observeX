"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";
import { validateTextContent } from "@/lib/security";

const MAX_FILE_BYTES      = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS  = ["log", "txt", "json", "jsonl"];

// FIX #20 — Plan tier limits: enforce maxMonthlyIngestMb before accepting upload.
// Previously maxMonthlyIngestMb existed in the schema but was never checked.
async function checkIngestQuota(workspaceId: string, incomingBytes: number): Promise<string | null> {
  const workspace = await db.workspace.findUnique({
    where:  { id: workspaceId },
    select: { maxMonthlyIngestMb: true },
  });
  if (!workspace) return "Workspace not found.";

  const limitMb = workspace.maxMonthlyIngestMb;
  if (limitMb <= 0) return null; // 0 = unlimited

  // Sum current month's uploads
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const agg = await db.upload.aggregate({
    where:  { workspaceId, status: "completed", createdAt: { gte: monthStart } },
    _sum:   { fileSizeBytes: true },
  });

  const usedBytes = agg._sum.fileSizeBytes ?? 0;
  const limitBytes = limitMb * 1024 * 1024;

  if (usedBytes + incomingBytes > limitBytes) {
    const usedMb  = (usedBytes  / 1024 / 1024).toFixed(1);
    const totalMb = limitMb.toFixed(0);
    return `Monthly ingest quota exceeded (${usedMb} MB used of ${totalMb} MB). Upgrade your plan or wait until next month.`;
  }
  return null;
}

export async function uploadLogAction(formData: FormData) {
  const user         = await requireUser();
  const workspaceId  = String(formData.get("workspaceId") || "");
  const fileName     = String(formData.get("fileName")    || "uploaded.log");
  const content      = String(formData.get("content")     || "");
  const sourceLabel  = String(formData.get("sourceLabel") || "manual upload");
  const environment  = String(formData.get("environment") || "unknown");

  if (!workspaceId || !content.trim()) return { ok: false, message: "Please provide a valid log file." };

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { ok: false, message: `Unsupported file type .${ext || "unknown"}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.` };
  }

  const byteSize = new TextEncoder().encode(content).length;
  if (byteSize > MAX_FILE_BYTES) {
    return { ok: false, message: `File is ${(byteSize / 1024 / 1024).toFixed(1)} MB — max is 15 MB.` };
  }

  // FIX #9 — Content type validation: check bytes are valid UTF-8 text, not binary.
  const contentCheck = validateTextContent(content);
  if (!contentCheck.ok) return { ok: false, message: contentCheck.reason ?? "Invalid file content." };

  const [membership, workspace] = await Promise.all([
    db.membership.findFirst({ where: { workspaceId, userId: user.id } }),
    db.workspace.findUnique({ where: { id: workspaceId } }),
  ]);
  if (!membership) return { ok: false, message: "You do not have access to this workspace." };
  if (!workspace)  return { ok: false, message: "Workspace not found." };

  // FIX #20 — Enforce monthly ingest quota
  const quotaError = await checkIngestQuota(workspaceId, byteSize);
  if (quotaError) return { ok: false, message: quotaError };

  const upload = await db.upload.create({
    data: {
      workspaceId, uploadedById: user.id, fileName,
      sourceType: "upload", contentType: ext || "text",
      sourceLabel, environment, status: "processing",
      fileSizeBytes: byteSize,
      rawText: content,
    },
  });

  try {
    const result = await ingestUpload({ workspaceId, uploadId: upload.id, content, environmentHint: environment });

    await db.upload.update({
      where: { id: upload.id },
      data: {
        status:         "completed",
        fileSizeBytes:  byteSize,
        recordCount:    result.recordCount,
        processedCount: result.recordCount,
        maskedCount:    result.maskedCount,
        droppedCount:   0,
        contentType:    result.parsed.sourceType,
        rawText:        `[${result.recordCount.toLocaleString()} records indexed]`,
        summaryJson:    result.summary as any,
        fingerprint:    result.fingerprint,
        completedAt:    new Date(),
      },
    });

    await db.auditEvent.create({
      data: {
        workspaceId, userId: user.id, action: "upload.created",
        details: `${fileName}: ${result.recordCount.toLocaleString()} records stored, ${result.maskedCount.toLocaleString()} PII-masked`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    await db.upload.update({
      where: { id: upload.id },
      data:  { status: "failed", ingestionError: message, rawText: "[ingestion failed]" },
    });
    return { ok: false, message };
  }

  const base = `/workspace/${workspaceId}/${workspace.slug}`;
  ["overview", "upload", "live-logs", "alerts", "flow-analytics", "security", "sources", "incidents", "anomalies", "latency"]
    .forEach((page) => revalidatePath(`${base}/${page}`));

  return { ok: true, message: `${fileName} uploaded and indexed successfully.` };
}
