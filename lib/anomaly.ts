import { db } from "@/lib/db";

export type AnomalyThresholds = {
  errorRateHighPct: number;
  errorRateCriticalPct: number;
  avgLatencyMediumMs: number;
  avgLatencyHighMs: number;
  piiHighCount: number;
  fatalCriticalCount: number;
  noisySignatureMin: number;
  lookbackDays: number;
  maxEvents: number;
};

export const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  errorRateHighPct: 15,
  errorRateCriticalPct: 30,
  avgLatencyMediumMs: 800,
  avgLatencyHighMs: 1500,
  piiHighCount: 10,
  fatalCriticalCount: 5,
  noisySignatureMin: 5,
  lookbackDays: 7,
  maxEvents: 5000,
};

export type AnomalyItem = {
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  detail: string;
  metric: string;
};

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export async function detectWorkspaceAnomalies(
  workspaceId: string,
  thresholds: Partial<AnomalyThresholds> = {}
) {
  const cfg = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * cfg.lookbackDays);

  const events = await db.logEvent.findMany({
    where: { workspaceId, timestamp: { gte: since } },
    select: { level: true, application: true, signature: true, containsPii: true, latencyMs: true },
    orderBy: { timestamp: "desc" },
    take: cfg.maxEvents,
  });

  const total = events.length || 1;
  const errorCount = events.filter((e) => /error|fatal/i.test(e.level)).length;
  const piiEvents = events.filter((e) => e.containsPii).length;
  const latencies = events.map((e) => e.latencyMs ?? 0).filter((n) => n > 0);
  const avgLatency = latencies.length ? Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length) : 0;
  const p95Latency = percentile(latencies, 95); // ✅ real value

  const fatalGroups = new Map<string, number>();
  const signatureGroups = new Map<string, number>();
  for (const event of events) {
    signatureGroups.set(event.signature, (signatureGroups.get(event.signature) ?? 0) + 1);
    if (/fatal/i.test(event.level)) fatalGroups.set(event.application, (fatalGroups.get(event.application) ?? 0) + 1);
  }

  const anomalies: AnomalyItem[] = [];
  const errorRate = Math.round((errorCount / total) * 1000) / 10;

  if (errorRate >= cfg.errorRateHighPct) {
    anomalies.push({ title: "Error spike detected", severity: errorRate >= cfg.errorRateCriticalPct ? "critical" : "high", detail: `${errorCount} errors in the last ${cfg.lookbackDays}d`, metric: `${errorRate}% error rate` });
  }
  if (avgLatency >= cfg.avgLatencyMediumMs) {
    anomalies.push({ title: "High latency trend", severity: avgLatency >= cfg.avgLatencyHighMs ? "high" : "medium", detail: `Avg ${avgLatency} ms, P95 ${p95Latency} ms`, metric: `avg ${avgLatency} ms` });
  }
  if (piiEvents > 0) {
    anomalies.push({ title: "Sensitive data exposure", severity: piiEvents >= cfg.piiHighCount ? "high" : "medium", detail: `Messages contain masked PII or secret patterns`, metric: `${piiEvents} flagged events` });
  }
  for (const [application, count] of fatalGroups.entries()) {
    if (count > 0) anomalies.push({ title: `Fatal events in ${application}`, severity: count >= cfg.fatalCriticalCount ? "critical" : "high", detail: `Application produced fatal-level events`, metric: `${count} fatal entries` });
  }

  const noisySignatures = Array.from(signatureGroups.entries())
    .filter(([, count]) => count >= cfg.noisySignatureMin)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([signature, count]) => ({ signature, count }));

  return { anomalies, noisySignatures, summary: { totalEvents: events.length, errorRate, avgLatency, p95Latency, piiEvents } };
}
