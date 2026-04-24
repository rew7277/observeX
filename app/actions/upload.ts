"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["log", "txt", "json", "jsonl"];

export async function uploadLogAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") || "");
  const fileName = String(formData.get("fileName") || "uploaded.log");
  const content = String(formData.get("content") || "");
  const sourceLabel = String(formData.get("sourceLabel") || "manual upload");
  const environment = String(formData.get("environment") || "unknown");

  if (!workspaceId || !content.trim()) return { ok: false, message: "Please provide a valid log file." };

  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(ext)) return { ok: false, message: `Unsupported file type .${ext || "unknown"}. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.` };

  const byteSize = new TextEncoder().encode(content).length;
  if (byteSize > MAX_FILE_BYTES) return { ok: false, message: `File is ${(byteSize / 1024 / 1024).toFixed(1)} MB — max is 15 MB.` };

  const [membership, workspace] = await Promise.all([
    db.membership.findFirst({ where: { workspaceId, userId: user.id } }),
    db.workspace.findUnique({ where: { id: workspaceId } }),
  ]);
  if (!membership) return { ok: false, message: "You do not have access to this workspace." };
  if (!workspace) return { ok: false, message: "Workspace not found." };

  // Create upload record (queued)
  const upload = await db.upload.create({
    data: {
      workspaceId, uploadedById: user.id, fileName,
      sourceType: "upload", contentType: ext || "text",
      sourceLabel, environment, status: "processing",
      fileSizeBytes: byteSize,
      rawText: content, // stored for async worker fallback
    },
  });

  try {
    const result = await ingestUpload({ workspaceId, uploadId: upload.id, content, environmentHint: environment });

    await db.upload.update({
      where: { id: upload.id },
      data: {
        status: "completed", fileSizeBytes: byteSize,
        recordCount: result.recordCount, processedCount: result.recordCount,
        maskedCount: result.maskedCount, droppedCount: 0,
        contentType: result.parsed.sourceType,
        rawText: `[${result.recordCount.toLocaleString()} records indexed]`,
        summaryJson: result.summary as any,
        fingerprint: result.fingerprint, completedAt: new Date(),
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
    await db.upload.update({ where: { id: upload.id }, data: { status: "failed", ingestionError: message, rawText: "[ingestion failed]" } });
    return { ok: false, message };
  }

  const base = `/workspace/${workspaceId}/${workspace.slug}`;
  ["overview", "upload", "live-logs", "alerts", "flow-analytics", "security", "sources", "incidents", "anomalies", "latency"].forEach((page) => revalidatePath(`${base}/${page}`));
  return { ok: true, message: `${fileName} uploaded and indexed successfully.` };
}
