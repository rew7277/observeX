import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";

// FIX #18 — Dead-letter queue: stop retrying after MAX_RETRIES failures.
// Previously a consistently failing upload would loop forever.
const MAX_RETRIES = 3;

export async function getBackgroundJobStatus(workspaceId: string) {
  const [queuedUploads, processingUploads, failedUploads, deadLetterUploads] = await Promise.all([
    db.upload.count({ where: { workspaceId, status: "queued" } }),
    db.upload.count({ where: { workspaceId, status: "processing" } }),
    db.upload.count({ where: { workspaceId, status: "failed" } }),
    // Dead-letter: failed uploads that have exhausted all retries
    db.upload.count({ where: { workspaceId, status: "failed", retryCount: { gte: MAX_RETRIES } } }),
  ]);
  return { queuedUploads, processingUploads, failedUploads, deadLetterUploads, workerMode: "poll-or-cron" };
}

async function processUpload(uploadId: string): Promise<void> {
  // Optimistic claim — prevents double-processing across concurrent workers
  const claimed = await db.upload.updateMany({
    where: { id: uploadId, status: "queued" },
    data:  { status: "processing" },
  });
  if (claimed.count === 0) return;

  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return;

  // FIX #18 — Dead-letter: don't retry past the limit
  if ((upload.retryCount ?? 0) >= MAX_RETRIES) {
    await db.upload.update({
      where: { id: uploadId },
      data:  { status: "failed", ingestionError: `Moved to dead-letter after ${MAX_RETRIES} failures`, completedAt: new Date() },
    });
    console.warn(`[Worker] Upload ${uploadId} moved to dead-letter after ${MAX_RETRIES} retries`);
    return;
  }

  try {
    const result = await ingestUpload({
      workspaceId: upload.workspaceId,
      uploadId:    upload.id,
      content:     upload.rawText,
      environmentHint: upload.environment ?? undefined,
    });
    await db.upload.update({
      where: { id: uploadId },
      data: {
        status:         "completed",
        recordCount:    result.recordCount,
        processedCount: result.recordCount,
        maskedCount:    result.maskedCount,
        fingerprint:    result.fingerprint,
        summaryJson:    result.summary as any,
        completedAt:    new Date(),
        ingestionError: null,
      },
    });
  } catch (err) {
    // FIX #18 — Increment retry counter; re-queue if under limit, dead-letter if over
    const currentRetry = (upload.retryCount ?? 0) + 1;
    const nextStatus   = currentRetry >= MAX_RETRIES ? "failed" : "queued";
    await db.upload.update({
      where: { id: uploadId },
      data: {
        status:         nextStatus,
        retryCount:     currentRetry,
        ingestionError: String(err),
        completedAt:    nextStatus === "failed" ? new Date() : null,
      },
    });
    console.error(`[Worker] Upload ${uploadId} failed (attempt ${currentRetry}/${MAX_RETRIES}):`, err);
  }
}

export async function runWorkerPass(batchSize = 5): Promise<number> {
  // FIX #18 — Only pick up uploads that still have retries remaining
  const queued = await db.upload.findMany({
    where: {
      status:     "queued",
      retryCount: { lt: MAX_RETRIES },
    },
    orderBy: { createdAt: "asc" },
    take:    batchSize,
    select:  { id: true },
  });
  await Promise.allSettled(queued.map((u) => processUpload(u.id)));
  return queued.length;
}

export async function startWorkerLoop(options: {
  batchSize?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
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
