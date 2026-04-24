import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export type AggregatedMetrics = {
  // ── Core counts ──────────────────────────────────────────────────────────────
  totalEvents: number;
  totalLogs: number;          // alias for totalEvents (used by overview page)
  errorCount: number;
  warnCount: number;
  infoCount: number;
  debugCount: number;
  alertCount: number;         // active alert rules count (used by alerts page)
  // ── Latency ──────────────────────────────────────────────────────────────────
  avgLatencyMs: number;
  avgLatency: number;         // alias for avgLatencyMs (used by overview page)
  p95LatencyMs: number;
  p95Latency: number;         // alias for p95LatencyMs (used by overview page)
  // ── Derived ──────────────────────────────────────────────────────────────────
  errorRate: number;
  health: string;             // "Healthy" | "Watch" | "Critical"
  // ── Grouped datasets ─────────────────────────────────────────────────────────
  applications: { name: string; count: number }[];
  environments: { name: string; count: number }[];
  slowestApplications: { name: string; avgLatency: number; count: number }[];
  busiestTraces: { traceId: string; count: number }[];
  // ── Signals ──────────────────────────────────────────────────────────────────
  anomalySignals: { label: string; value: string }[];
  topSignatures: { signature: string; count: number }[];
  // ── Chart data ───────────────────────────────────────────────────────────────
  timeline: { time: string; errors: number; warnings: number; avgLatency: number }[];
  levels: { level: string; count: number }[];
};

export type LogRecord = {
  id: string;
  timestamp: Date;
  level: string;
  application: string;
  environment: string;
  traceId: string;
  message: string;
  latencyMs: number;
  signature: string;
  containsPii: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Lightweight workspace check (used by pages that only need auth/slug validation)
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Full workspace context — all queries run in parallel; Node receives only
// aggregated results rather than thousands of raw rows.
// ─────────────────────────────────────────────────────────────────────────────
export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const [
    workspace,
    piiSummary,
    levelCounts,
    appCounts,
    envCounts,
    latencyStats,
    alertCount,
    slowestApps,
    traceGroups,
    signatureGroups,
    recentSample,
  ] = await Promise.all([
    // ── Workspace + relations ─────────────────────────────────────────────────
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

    // ── PII split ────────────────────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["containsPii"], where: { workspaceId }, _count: { _all: true } })
      .catch(() => []),

    // ── Level distribution ───────────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["level"], where: { workspaceId }, _count: { _all: true },
                 orderBy: { _count: { level: "desc" } }, take: 10 })
      .catch(() => []),

    // ── Application distribution ─────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["application"], where: { workspaceId }, _count: { _all: true },
                 orderBy: { _count: { application: "desc" } }, take: 8 })
      .catch(() => []),

    // ── Environment distribution ─────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["environment"], where: { workspaceId }, _count: { _all: true },
                 orderBy: { _count: { environment: "desc" } }, take: 6 })
      .catch(() => []),

    // ── Latency aggregate ────────────────────────────────────────────────────
    db.logEvent
      .aggregate({ where: { workspaceId }, _avg: { latencyMs: true }, _count: { _all: true } })
      .catch(() => ({ _avg: { latencyMs: 0 }, _count: { _all: 0 } })),

    // ── Active alert rule count ──────────────────────────────────────────────
    db.alertRule
      .count({ where: { workspaceId, enabled: true } })
      .catch(() => 0),

    // ── Slowest applications by avg latency ──────────────────────────────────
    db.logEvent
      .groupBy({ by: ["application"], where: { workspaceId },
                 _avg: { latencyMs: true }, _count: { _all: true },
                 orderBy: { _avg: { latencyMs: "desc" } }, take: 10 })
      .catch(() => []),

    // ── Busiest trace IDs ────────────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["traceId"], where: { workspaceId, NOT: { traceId: "" } },
                 _count: { _all: true },
                 orderBy: { _count: { traceId: "desc" } }, take: 12 })
      .catch(() => []),

    // ── Top error/warn signatures ────────────────────────────────────────────
    db.logEvent
      .groupBy({ by: ["signature"], where: { workspaceId, level: { in: ["ERROR", "WARN"] } },
                 _count: { _all: true },
                 orderBy: { _count: { signature: "desc" } }, take: 15 })
      .catch(() => []),

    // ── Small time-ordered sample for timeline chart (max 500 rows) ──────────
    db.logEvent
      .findMany({ where: { workspaceId },
                  orderBy: { timestamp: "desc" }, take: 500,
                  select: { timestamp: true, level: true, latencyMs: true } })
      .catch(() => []),
  ]);

  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships.find((m) => m.userId === userId);
  if (!membership) notFound();

  // ── Derived scalars ─────────────────────────────────────────────────────────
  const totalEvents  = latencyStats._count._all ?? 0;
  const errorCount   = levelCounts.find((l) => l.level === "ERROR")?._count._all ?? 0;
  const warnCount    = levelCounts.find((l) => l.level === "WARN")?._count._all  ?? 0;
  const infoCount    = levelCounts.find((l) => l.level === "INFO")?._count._all  ?? 0;
  const debugCount   = levelCounts.find((l) => l.level === "DEBUG")?._count._all ?? 0;
  const avgLatencyMs = Math.round(latencyStats._avg.latencyMs ?? 0);
  const errorRate    = totalEvents > 0
    ? Math.round((errorCount / totalEvents) * 100 * 10) / 10
    : 0;

  // P95 approximation from the recent sample (avoids a full-table sort)
  const sortedLatencies = recentSample
    .map((r) => r.latencyMs)
    .sort((a, b) => a - b);
  const p95LatencyMs =
    sortedLatencies.length > 0
      ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] ?? 0
      : 0;

  // ── Health signal ───────────────────────────────────────────────────────────
  const health =
    errorRate > 10 ? "Critical" :
    errorRate > 3  ? "Watch"    :
                     "Healthy";

  // ── Anomaly signals (simple threshold-based) ────────────────────────────────
  const anomalySignals: { label: string; value: string }[] = [];
  if (errorRate > 10)
    anomalySignals.push({ label: "High error rate",    value: `${errorRate}% of events are errors` });
  if (avgLatencyMs > 500)
    anomalySignals.push({ label: "High avg latency",   value: `Average response time is ${avgLatencyMs} ms` });
  if (errorCount > 1000)
    anomalySignals.push({ label: "Error volume spike", value: `${errorCount.toLocaleString()} error events indexed` });

  // ── Timeline — bucket sample into hourly slots ──────────────────────────────
  const bucketMap = new Map<string, { errors: number; warnings: number; latencies: number[] }>();
  for (const row of recentSample) {
    const d    = new Date(row.timestamp);
    const slot = [
      d.getUTCFullYear(),
      String(d.getUTCMonth() + 1).padStart(2, "0"),
      String(d.getUTCDate()).padStart(2, "0"),
    ].join("-") + " " + String(d.getUTCHours()).padStart(2, "0") + ":00";
    if (!bucketMap.has(slot)) bucketMap.set(slot, { errors: 0, warnings: 0, latencies: [] });
    const b = bucketMap.get(slot)!;
    if (row.level === "ERROR") b.errors++;
    if (row.level === "WARN")  b.warnings++;
    b.latencies.push(row.latencyMs);
  }
  const timeline = Array.from(bucketMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([time, b]) => ({
      time,
      errors:     b.errors,
      warnings:   b.warnings,
      avgLatency: b.latencies.length
        ? Math.round(b.latencies.reduce((s, v) => s + v, 0) / b.latencies.length)
        : 0,
    }));

  // ── Level chart data ────────────────────────────────────────────────────────
  const levels = levelCounts.map((l) => ({ level: l.level, count: l._count._all }));

  // ── Slowest applications ────────────────────────────────────────────────────
  const slowestApplications = slowestApps.map((a) => ({
    name:       a.application,
    avgLatency: Math.round(a._avg.latencyMs ?? 0),
    count:      a._count._all,
  }));

  // ── Busiest traces (filter out blank/placeholder IDs) ───────────────────────
  const FAKE_TRACE_RE = /^(none|null|undefined|n\/a|-)$/i;
  const busiestTraces = traceGroups
    .filter((t) => t.traceId && t.traceId.length >= 6 && !FAKE_TRACE_RE.test(t.traceId))
    .map((t) => ({ traceId: t.traceId, count: t._count._all }));

  // ── Top signatures ──────────────────────────────────────────────────────────
  const topSignatures = signatureGroups
    .filter((s) => s.signature && s.signature.length > 0)
    .map((s) => ({ signature: s.signature, count: s._count._all }));

  // ── Final metrics object ────────────────────────────────────────────────────
  const metrics: AggregatedMetrics = {
    totalEvents,
    totalLogs:   totalEvents,
    errorCount,
    warnCount,
    infoCount,
    debugCount,
    alertCount,
    avgLatencyMs,
    avgLatency:  avgLatencyMs,
    p95LatencyMs,
    p95Latency:  p95LatencyMs,
    errorRate,
    health,
    applications: appCounts.map((a) => ({ name: a.application, count: a._count._all })),
    environments: envCounts.map((e) => ({ name: e.environment, count: e._count._all })),
    slowestApplications,
    busiestTraces,
    anomalySignals,
    topSignatures,
    timeline,
    levels,
  };

  return {
    workspace,
    membership,
    metrics,
    // flow-analytics fetches its own scoped slice; properly typed so TS is happy
    records: [] as LogRecord[],
    securityStats: {
      piiEvents:   piiSummary.find((i) =>  i.containsPii)?._count._all ?? 0,
      cleanEvents: piiSummary.find((i) => !i.containsPii)?._count._all ?? 0,
    },
  };
}
