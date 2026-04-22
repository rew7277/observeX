import { db } from "@/lib/db";

export async function detectWorkspaceAnomalies(workspaceId: string) {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
  const events = await db.logEvent.findMany({
    where: { workspaceId, timestamp: { gte: since } },
    orderBy: { timestamp: "desc" },
    take: 5000,
  });

  const total = events.length || 1;
  const errorCount = events.filter((event) => /error|fatal/i.test(event.level)).length;
  const piiEvents = events.filter((event) => event.containsPii).length;
  const avgLatency = Math.round(events.reduce((sum, event) => sum + (event.latencyMs || 0), 0) / total);
  const fatalGroups = new Map<string, number>();
  const signatureGroups = new Map<string, number>();

  for (const event of events) {
    signatureGroups.set(event.signature, (signatureGroups.get(event.signature) || 0) + 1);
    if (/fatal/i.test(event.level)) fatalGroups.set(event.application, (fatalGroups.get(event.application) || 0) + 1);
  }

  const anomalies = [] as Array<{ title: string; severity: "low" | "medium" | "high" | "critical"; detail: string; metric: string }>;

  const errorRate = Math.round((errorCount / total) * 1000) / 10;
  if (errorRate >= 15) anomalies.push({ title: "Error spike detected", severity: errorRate >= 30 ? "critical" : "high", detail: `${errorCount} errors in the recent event window`, metric: `${errorRate}% error rate` });
  if (avgLatency >= 800) anomalies.push({ title: "High latency trend", severity: avgLatency >= 1500 ? "high" : "medium", detail: `Average response latency is elevated`, metric: `${avgLatency} ms` });
  if (piiEvents > 0) anomalies.push({ title: "Sensitive data exposure", severity: piiEvents >= 10 ? "high" : "medium", detail: `Messages contain masked PII or secret patterns`, metric: `${piiEvents} flagged events` });

  for (const [application, count] of fatalGroups.entries()) {
    if (count > 0) anomalies.push({ title: `Fatal events in ${application}`, severity: count >= 5 ? "critical" : "high", detail: `Application produced fatal-level events`, metric: `${count} fatal entries` });
  }

  const noisySignatures = Array.from(signatureGroups.entries())
    .filter(([, count]) => count >= 5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([signature, count]) => ({ signature, count }));

  return {
    anomalies,
    noisySignatures,
    summary: {
      totalEvents: events.length,
      errorRate,
      avgLatency,
      piiEvents,
    },
  };
}
