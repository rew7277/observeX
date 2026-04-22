import { db } from "@/lib/db";
import { buildMetrics, type LogRecord } from "@/lib/log-parser";
import { notFound } from "next/navigation";

const MAX_OVERVIEW_RECORDS = 15000;

function toLogRecord(event: any): LogRecord {
  return {
    timestamp: event.timestamp.toISOString(),
    level: event.level,
    application: event.application,
    environment: event.environment,
    traceId: event.traceId,
    latencyMs: event.latencyMs,
    message: event.message,
    payloadJson: (event.payloadJson as Record<string, unknown> | null) ?? null
  };
}

export async function getWorkspaceBasic(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      planTier: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships[0];
  if (!membership) notFound();

  return { workspace, membership };
}

export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invites: { orderBy: { createdAt: "desc" }, take: 10 },
      apiSources: { orderBy: { createdAt: "desc" }, take: 10 },
      sourceRuns: { orderBy: { startedAt: "desc" }, take: 10, include: { apiSource: true } },
      alertRules: { orderBy: { createdAt: "desc" }, take: 10 },
      uploads: { orderBy: { createdAt: "desc" }, take: 20 },
      auditEvents: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
      savedSearches: { orderBy: { createdAt: "desc" }, take: 10 }
    }
  });

  if (!workspace || workspace.slug !== slug) notFound();

  const membership = workspace.memberships.find((item) => item.userId === userId);
  if (!membership) notFound();

  const eventRows = await db.logEvent.findMany({
    where: { workspaceId },
    orderBy: { timestamp: "desc" },
    take: MAX_OVERVIEW_RECORDS
  });

  let records = eventRows.map(toLogRecord);

  if (!records.length) {
    let total = 0;
    records = [];
    for (const upload of workspace.uploads) {
      const rows = ((upload.parsedJson as any[]) || []).slice(0, Math.max(0, MAX_OVERVIEW_RECORDS - total));
      records.push(...rows);
      total += rows.length;
      if (total >= MAX_OVERVIEW_RECORDS) break;
    }
  }

  const metrics = buildMetrics(records);

  const piiSummary = await db.logEvent.groupBy({
    by: ["containsPii"],
    where: { workspaceId },
    _count: { _all: true }
  }).catch(() => []);

  return {
    workspace,
    membership,
    records,
    metrics,
    securityStats: {
      piiEvents: piiSummary.find((item) => item.containsPii)?._count._all || 0,
      cleanEvents: piiSummary.find((item) => !item.containsPii)?._count._all || 0
    }
  };
}
