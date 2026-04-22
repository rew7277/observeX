import { db } from "@/lib/db";

function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)] || 0;
}

export async function getLatencyInsights(workspaceId: string) {
  const events = await db.logEvent.findMany({ where: { workspaceId }, orderBy: { timestamp: "desc" }, take: 5000 });
  const values = events.map((event) => event.latencyMs || 0).filter(Boolean);
  const byEnv = new Map<string, number[]>();
  const byApp = new Map<string, number[]>();

  for (const event of events) {
    if (!byEnv.has(event.environment)) byEnv.set(event.environment, []);
    if (!byApp.has(event.application)) byApp.set(event.application, []);
    byEnv.get(event.environment)!.push(event.latencyMs || 0);
    byApp.get(event.application)!.push(event.latencyMs || 0);
  }

  return {
    percentiles: {
      p50: percentile(values, 50),
      p75: percentile(values, 75),
      p90: percentile(values, 90),
      p95: percentile(values, 95),
      p99: percentile(values, 99),
    },
    environments: Array.from(byEnv.entries()).map(([name, latencies]) => ({ name, p95: percentile(latencies, 95), avg: Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) })).sort((a, b) => b.p95 - a.p95),
    applications: Array.from(byApp.entries()).map(([name, latencies]) => ({ name, p95: percentile(latencies, 95), avg: Math.round(latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) })).sort((a, b) => b.p95 - a.p95).slice(0, 10),
  };
}
