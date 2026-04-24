import { db } from "@/lib/db";

// FIX #15 — Retention job is now actually called from the cron route.
// Deletes LogEvent rows older than each workspace's retentionDays setting.
export async function runRetentionPass(): Promise<number> {
  const workspaces = await db.workspace.findMany({
    select: { id: true, retentionDays: true },
  });

  let totalDeleted = 0;

  for (const workspace of workspaces) {
    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * workspace.retentionDays);
    try {
      const result = await db.logEvent.deleteMany({
        where: {
          workspaceId: workspace.id,
          timestamp:   { lt: cutoff },
        },
      });
      if (result.count > 0) {
        console.info(`[Retention] Workspace ${workspace.id}: deleted ${result.count} events older than ${workspace.retentionDays} days`);
        totalDeleted += result.count;
      }
    } catch (err) {
      console.error(`[Retention] Workspace ${workspace.id} failed:`, err);
    }
  }

  return totalDeleted;
}

export async function getWorkspaceQuotaReport(workspaceId: string) {
  const [workspace, uploads, members, events] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId } }),
    db.upload.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.membership.count({ where: { workspaceId } }),
    db.logEvent.count({ where: { workspaceId } }),
  ]);

  const usedBytes    = uploads.reduce((sum, upload) => sum + upload.fileSizeBytes, 0);
  const usedMb       = Math.round((usedBytes / 1024 / 1024) * 10) / 10;
  const ingestLimitMb = workspace?.maxMonthlyIngestMb || 0;

  return {
    workspace,
    usage: {
      usedMb,
      ingestLimitMb,
      usagePercent:  ingestLimitMb ? Math.min(100, Math.round((usedMb / ingestLimitMb) * 100)) : 0,
      members,
      memberLimit:   workspace?.maxUsers || 0,
      eventCount:    events,
      uploadCount:   uploads.length,
    },
    recentUploads: uploads,
  };
}

export async function getRetentionPreview(workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24 * (workspace?.retentionDays || 30));
  const expiringUploads = await db.upload.findMany({
    where: { workspaceId, createdAt: { lt: cutoff } },
    orderBy: { createdAt: "asc" },
    take: 20,
  });
  return { cutoff, expiringUploads };
}
