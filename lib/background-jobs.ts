import { db } from "@/lib/db";

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
    workerMode: "manual-or-cron",
    note: "Wire this helper to a scheduled job runner or background worker to process queued uploads asynchronously.",
  };
}
