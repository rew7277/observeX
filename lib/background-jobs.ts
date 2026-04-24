import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";

export async function getBackgroundJobStatus(workspaceId: string) {
  const [queuedUploads, processingUploads, failedUploads] = await Promise.all([
    db.upload.count({ where: { workspaceId, status: "queued" } }),
    db.upload.count({ where: { workspaceId, status: "processing" } }),
    db.upload.count({ where: { workspaceId, status: "failed" } }),
  ]);
  return { queuedUploads, processingUploads, failedUploads, workerMode: "poll-or-cron" };
}

async function processUpload(uploadId: string): Promise<void> {
  // Optimistic claim — prevents double-processing
  const claimed = await db.upload.updateMany({ where: { id: uploadId, status: "queued" }, data: { status: "processing" } });
  if (claimed.count === 0) return;

  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return;

  try {
    const result = await ingestUpload({ workspaceId: upload.workspaceId, uploadId: upload.id, content: upload.rawText, environmentHint: upload.environment ?? undefined });
    await db.upload.update({
      where: { id: uploadId },
      data: { status: "completed", recordCount: result.recordCount, processedCount: result.recordCount, maskedCount: result.maskedCount, fingerprint: result.fingerprint, summaryJson: result.summary as any, completedAt: new Date(), ingestionError: null },
    });
  } catch (err) {
    await db.upload.update({ where: { id: uploadId }, data: { status: "failed", ingestionError: String(err), completedAt: new Date() } });
    console.error(`[Worker] Upload ${uploadId} failed:`, err);
  }
}

export async function runWorkerPass(batchSize = 5): Promise<number> {
  const queued = await db.upload.findMany({ where: { status: "queued" }, orderBy: { createdAt: "asc" }, take: batchSize, select: { id: true } });
  await Promise.allSettled(queued.map((u) => processUpload(u.id)));
  return queued.length;
}

export async function startWorkerLoop(options: { batchSize?: number; pollIntervalMs?: number; signal?: AbortSignal }): Promise<void> {
  const { batchSize = 5, pollIntervalMs = 10_000, signal } = options;
  console.info("[Worker] Starting upload processing loop");
  while (!signal?.aborted) {
    try {
      const processed = await runWorkerPass(batchSize);
      if (processed > 0) console.info(`[Worker] Processed ${processed} uploads`);
    } catch (err) {
      console.error("[Worker] Error:", err);
    }
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(); }, { once: true });
    }).catch(() => {});
  }
  console.info("[Worker] Stopped");
}
