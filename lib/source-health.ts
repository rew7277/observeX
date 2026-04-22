import { db } from "@/lib/db";

export async function getSourceHealth(workspaceId: string) {
  const [sources, recentRuns] = await Promise.all([
    db.apiSource.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } }),
    db.sourceRun.findMany({ where: { workspaceId }, include: { apiSource: true }, orderBy: { startedAt: "desc" }, take: 30 }),
  ]);

  const now = Date.now();
  return {
    summary: {
      total: sources.length,
      active: sources.filter((item) => item.status === "active").length,
      unhealthy: sources.filter((item) => item.status === "error" || item.lastError).length,
      stale: sources.filter((item) => !item.lastSyncAt || now - new Date(item.lastSyncAt).getTime() > 1000 * 60 * 60 * 24).length,
    },
    sources,
    recentRuns,
  };
}
