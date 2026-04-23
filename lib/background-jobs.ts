import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";

// ---------------------------------------------------------------------------
// Status report (unchanged — used by the UI quotas page)
// ---------------------------------------------------------------------------

export async function getBackgroundJobStatus(workspaceId: string) {
  const [queuedUploads, processingUploads, failedUploads] = await Promise.all([
    db.upload.count({ where: { workspaceId, status: "queued" } }),
    db.upload.count({ where: { workspaceId, status: "processing" } }),
    db.upload.count({ where: { workspaceId, status: "failed" } }),
  ]);

  return {
    queuedUploads,
    processingUploads,
    failedUploads,
    workerMode: "poll-or-cron",
  };
}

// ---------------------------------------------------------------------------
// Process a single queued upload
// ---------------------------------------------------------------------------

async function processUpload(uploadId: string): Promise<void> {
  // Claim the upload — set status to "processing" with an optimistic lock.
  const claimed = await db.upload.updateMany({
    where: { id: uploadId, status: "queued" },
    data:  { status: "processing" },
  });

  if (claimed.count === 0) {
    // Already claimed by another worker — skip silently
    return;
  }

  const upload = await db.upload.findUnique({ where: { id: uploadId } });
  if (!upload) return;

  try {
    const result = await ingestUpload({
      workspaceId:     upload.workspaceId,
      uploadId:        upload.id,
      content:         upload.rawText,
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
    await db.upload.update({
      where: { id: uploadId },
      data: {
        status:         "failed",
        ingestionError: String(err),
        completedAt:    new Date(),
      },
    });
    console.error(`[Worker] Upload ${uploadId} failed:`, err);
  }
}

// ---------------------------------------------------------------------------
// Poll-based worker — call this from a cron endpoint or a long-running server
// ---------------------------------------------------------------------------

const DEFAULT_BATCH = 5;
const DEFAULT_POLL_INTERVAL_MS = 10_000;

/**
 * Processes up to `batchSize` queued uploads in one pass.
 * Returns the number of uploads processed.
 *
 * Usage in a cron route (e.g. /api/cron/worker):
 *
 *   import { runWorkerPass } from "@/lib/background-jobs";
 *   export async function GET() {
 *     const processed = await runWorkerPass();
 *     return Response.json({ processed });
 *   }
 */
export async function runWorkerPass(batchSize = DEFAULT_BATCH): Promise<number> {
  const queued = await db.upload.findMany({
    where:   { status: "queued" },
    orderBy: { createdAt: "asc" },
    take:    batchSize,
    select:  { id: true },
  });

  await Promise.allSettled(queued.map((u) => processUpload(u.id)));
  return queued.length;
}

/**
 * Long-running polling loop — suitable for a Node.js background process.
 * Pass an AbortSignal to stop it gracefully.
 *
 *   const ac = new AbortController();
 *   process.on("SIGTERM", () => ac.abort());
 *   await startWorkerLoop({ signal: ac.signal });
 */
export async function startWorkerLoop(options: {
  batchSize?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}): Promise<void> {
  const { batchSize = DEFAULT_BATCH, pollIntervalMs = DEFAULT_POLL_INTERVAL_MS, signal } = options;

  console.info("[Worker] Starting upload processing loop");

  while (!signal?.aborted) {
    try {
      const processed = await runWorkerPass(batchSize);
      if (processed > 0) {
        console.info(`[Worker] Processed ${processed} uploads`);
      }
    } catch (err) {
      console.error("[Worker] Unexpected error in worker pass:", err);
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, pollIntervalMs);
      signal?.addEventListener("abort", () => { clearTimeout(timer); reject(); }, { once: true });
    }).catch(() => { /* aborted */ });
  }

  console.info("[Worker] Stopped");
}
