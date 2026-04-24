import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export type AggregatedMetrics = {
  totalEvents: number;
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  applications: { name: string; count: number }[];
  environments: { name: string; count: number }[];
  errorRate: number;
};

export async function getWorkspaceBasic(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true, name: true, slug: true, planTier: true,
      memberships: { where: { userId }, select: { role: true }, take: 1 },
    },
  });
  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships[0];
  if (!membership) notFound();
  return { workspace, membership };
}

// FIX #12 — Replace 15,000-row full fetch with aggregation queries.
// Postgres does the math; Node receives only counts and averages.
export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const [workspace, piiSummary, levelCounts, appCounts, envCounts, latencyStats] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships:   { include: { user: true }, orderBy: { createdAt: "asc" } },
        invites:       { orderBy: { createdAt: "desc" }, take: 10 },
        apiSources:    { orderBy: { createdAt: "desc" }, take: 10 },
        sourceRuns:    { orderBy: { startedAt: "desc" }, take: 10, include: { apiSource: true } },
        alertRules:    { orderBy: { createdAt: "desc" }, take: 10 },
        alertChannels: { orderBy: { createdAt: "desc" }, take: 10 },
        uploads:       { orderBy: { createdAt: "desc" }, take: 20 },
        auditEvents:   { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
        savedSearches: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    }),
    db.logEvent.groupBy({ by: ["containsPii"], where: { workspaceId }, _count: { _all: true } }).catch(() => []),
    db.logEvent.groupBy({ by: ["level"],       where: { workspaceId }, _count: { _all: true }, orderBy: { _count: { level: "desc" } }, take: 10 }).catch(() => []),
    db.logEvent.groupBy({ by: ["application"], where: { workspaceId }, _count: { _all: true }, orderBy: { _count: { application: "desc" } }, take: 8 }).catch(() => []),
    db.logEvent.groupBy({ by: ["environment"], where: { workspaceId }, _count: { _all: true }, orderBy: { _count: { environment: "desc" } }, take: 6 }).catch(() => []),
    db.logEvent.aggregate({ where: { workspaceId }, _avg: { latencyMs: true }, _count: { _all: true } }).catch(() => ({ _avg: { latencyMs: 0 }, _count: { _all: 0 } })),
  ]);

  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships.find((m) => m.userId === userId);
  if (!membership) notFound();

  const totalEvents = latencyStats._count._all ?? 0;
  const errorCount  = levelCounts.find((l) => l.level === "ERROR")?._count._all ?? 0;
  const warnCount   = levelCounts.find((l) => l.level === "WARN")?._count._all ?? 0;
  const infoCount   = levelCounts.find((l) => l.level === "INFO")?._count._all ?? 0;
  const debugCount  = levelCounts.find((l) => l.level === "DEBUG")?._count._all ?? 0;

  const metrics: AggregatedMetrics = {
    totalEvents,
    errorCount,
    warnCount,
    infoCount,
    debugCount,
    avgLatencyMs: Math.round(latencyStats._avg.latencyMs ?? 0),
    p95LatencyMs: 0,
    applications: appCounts.map((a) => ({ name: a.application, count: a._count._all })),
    environments: envCounts.map((e) => ({ name: e.environment, count: e._count._all })),
    errorRate: totalEvents > 0 ? Math.round((errorCount / totalEvents) * 100 * 10) / 10 : 0,
  };

  return {
    workspace,
    membership,
    metrics,
    records: [] as never[], // removed heavy fetch — pages fetch their own scoped slices
    securityStats: {
      piiEvents:   piiSummary.find((i) =>  i.containsPii)?._count._all ?? 0,
      cleanEvents: piiSummary.find((i) => !i.containsPii)?._count._all ?? 0,
    },
  };
}
