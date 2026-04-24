import { db } from "@/lib/db";
import { buildMetrics, type LogRecord } from "@/lib/log-parser";
import { notFound } from "next/navigation";

const MAX_OVERVIEW_RECORDS = 15000;

function toLogRecord(event: {
  timestamp: Date; level: string; application: string; environment: string;
  traceId: string; latencyMs: number; message: string; payloadJson: unknown;
}): LogRecord {
  return {
    timestamp: event.timestamp.toISOString(),
    level: event.level,
    application: event.application,
    environment: event.environment,
    traceId: event.traceId,
    latencyMs: event.latencyMs,
    message: event.message,
    payloadJson: (event.payloadJson as Record<string, unknown> | null) ?? null,
  };
}

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

export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const [workspace, eventRows, piiSummary] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
        invites: { orderBy: { createdAt: "desc" }, take: 10 },
        apiSources: { orderBy: { createdAt: "desc" }, take: 10 },
        sourceRuns: { orderBy: { startedAt: "desc" }, take: 10, include: { apiSource: true } },
        alertRules: { orderBy: { createdAt: "desc" }, take: 10 },
        alertChannels: { orderBy: { createdAt: "desc" }, take: 10 },
        uploads: { orderBy: { createdAt: "desc" }, take: 20 },
        auditEvents: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
        savedSearches: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    }),
    db.logEvent.findMany({
      where: { workspaceId },
      orderBy: { timestamp: "desc" },
      take: MAX_OVERVIEW_RECORDS,
      select: { timestamp: true, level: true, application: true, environment: true, traceId: true, latencyMs: true, message: true, payloadJson: true },
    }),
    db.logEvent.groupBy({ by: ["containsPii"], where: { workspaceId }, _count: { _all: true } }).catch(() => []),
  ]);

  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships.find((m) => m.userId === userId);
  if (!membership) notFound();

  // ✅ LogEvent is always the source of truth — no parsedJson fallback
  const records = eventRows.map(toLogRecord);
  const metrics = buildMetrics(records);

  return {
    workspace,
    membership,
    records,
    metrics,
    securityStats: {
      piiEvents: piiSummary.find((i) => i.containsPii)?._count._all ?? 0,
      cleanEvents: piiSummary.find((i) => !i.containsPii)?._count._all ?? 0,
    },
  };
}
