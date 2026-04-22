import { db } from "@/lib/db";

export async function getWorkspaceQuotaReport(workspaceId: string) {
  const [workspace, uploads, members, events] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId } }),
    db.upload.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" }, take: 200 }),
    db.membership.count({ where: { workspaceId } }),
    db.logEvent.count({ where: { workspaceId } }),
  ]);

  const usedBytes = uploads.reduce((sum, upload) => sum + upload.fileSizeBytes, 0);
  const usedMb = Math.round((usedBytes / 1024 / 1024) * 10) / 10;
  const ingestLimitMb = workspace?.maxMonthlyIngestMb || 0;

  return {
    workspace,
    usage: {
      usedMb,
      ingestLimitMb,
      usagePercent: ingestLimitMb ? Math.min(100, Math.round((usedMb / ingestLimitMb) * 100)) : 0,
      members,
      memberLimit: workspace?.maxUsers || 0,
      eventCount: events,
      uploadCount: uploads.length,
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
