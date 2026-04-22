import { db } from "@/lib/db";
import { detectWorkspaceAnomalies } from "@/lib/anomaly";

function compare(metric: number, operator: string, threshold: number) {
  switch (operator) {
    case ">": return metric > threshold;
    case ">=": return metric >= threshold;
    case "<": return metric < threshold;
    case "<=": return metric <= threshold;
    default: return false;
  }
}

export async function evaluateAlertRules(workspaceId: string) {
  const rules = await db.alertRule.findMany({ where: { workspaceId, enabled: true }, orderBy: { createdAt: "desc" } });
  const anomaly = await detectWorkspaceAnomalies(workspaceId);
  const metrics: Record<string, number> = {
    errorRate: anomaly.summary.errorRate,
    avgLatency: anomaly.summary.avgLatency,
    p95Latency: Math.round(anomaly.summary.avgLatency * 1.4),
    warnCount: anomaly.summary.totalEvents,
    criticalSignals: anomaly.anomalies.filter((item) => item.severity === "critical").length,
    piiEvents: anomaly.summary.piiEvents,
  };

  return rules.map((rule) => ({
    rule,
    currentValue: metrics[rule.metric] ?? 0,
    triggered: compare(metrics[rule.metric] ?? 0, rule.operator, Number(rule.threshold)),
  }));
}
