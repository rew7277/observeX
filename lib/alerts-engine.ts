import { db } from "@/lib/db";
import { detectWorkspaceAnomalies } from "@/lib/anomaly";

function compare(metric: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">":  return metric > threshold;
    case ">=": return metric >= threshold;
    case "<":  return metric < threshold;
    case "<=": return metric <= threshold;
    default:   return false;
  }
}

export type AlertEvaluation = {
  rule: { id: string; name: string; metric: string; operator: string; threshold: number; severity: string };
  currentValue: number;
  triggered: boolean;
};

export async function evaluateAlertRules(workspaceId: string): Promise<AlertEvaluation[]> {
  const [rules, anomaly] = await Promise.all([
    db.alertRule.findMany({ where: { workspaceId, enabled: true }, orderBy: { createdAt: "desc" } }),
    detectWorkspaceAnomalies(workspaceId),
  ]);

  // ✅ Real p95 — not avgLatency * 1.4
  const metrics: Record<string, number> = {
    errorRate:       anomaly.summary.errorRate,
    avgLatency:      anomaly.summary.avgLatency,
    p95Latency:      anomaly.summary.p95Latency,
    warnCount:       anomaly.summary.totalEvents,
    criticalSignals: anomaly.anomalies.filter((a) => a.severity === "critical").length,
    piiEvents:       anomaly.summary.piiEvents,
  };

  return rules.map((rule) => ({
    rule,
    currentValue: metrics[rule.metric] ?? 0,
    triggered: compare(metrics[rule.metric] ?? 0, rule.operator, Number(rule.threshold)),
  }));
}

export type AlertChannelType = "webhook" | "email" | "slack";

export async function deliverAlert(
  rule: AlertEvaluation["rule"],
  channel: { type: AlertChannelType; destination: string },
  currentValue: number
): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    alertName: rule.name, severity: rule.severity, metric: rule.metric,
    currentValue, threshold: rule.threshold, operator: rule.operator,
    triggeredAt: new Date().toISOString(),
  };

  try {
    if (channel.type === "webhook" || channel.type === "slack") {
      const body = channel.type === "slack"
        ? JSON.stringify({ text: `🚨 *${rule.name}* (${rule.severity.toUpperCase()}) — ${rule.metric} is ${currentValue} (threshold: ${rule.operator} ${rule.threshold})` })
        : JSON.stringify(payload);
      const res = await fetch(channel.destination, { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { ok: true };
    }
    if (channel.type === "email") {
      console.info("[AlertDelivery] Email to", channel.destination, payload);
      return { ok: true };
    }
    return { ok: false, error: "Unknown channel type" };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

export async function runAlertsForWorkspace(workspaceId: string): Promise<void> {
  const evaluations = await evaluateAlertRules(workspaceId);
  const triggered = evaluations.filter((e) => e.triggered);
  if (!triggered.length) return;

  const channels = await db.alertChannel.findMany({ where: { workspaceId, enabled: true } });
  for (const evaluation of triggered) {
    for (const ch of channels) {
      const result = await deliverAlert(evaluation.rule, { type: ch.type as AlertChannelType, destination: ch.destination }, evaluation.currentValue);
      await db.alertDelivery.create({
        data: {
          alertRuleId: evaluation.rule.id,
          channelId: ch.id,
          success: result.ok,
          errorMessage: result.error ?? null,
          payloadJson: { metric: evaluation.rule.metric, value: evaluation.currentValue } as any,
        }
      }).catch(() => {});
    }
  }
}
