import { db } from "@/lib/db";
import { detectWorkspaceAnomalies } from "@/lib/anomaly";

// ---------------------------------------------------------------------------
// Metric comparator
// ---------------------------------------------------------------------------

function compare(metric: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case ">":  return metric > threshold;
    case ">=": return metric >= threshold;
    case "<":  return metric < threshold;
    case "<=": return metric <= threshold;
    default:   return false;
  }
}

// ---------------------------------------------------------------------------
// Alert evaluation
// ---------------------------------------------------------------------------

export type AlertEvaluation = {
  rule: {
    id: string;
    name: string;
    metric: string;
    operator: string;
    threshold: number;
    severity: string;
  };
  currentValue: number;
  triggered: boolean;
};

export async function evaluateAlertRules(workspaceId: string): Promise<AlertEvaluation[]> {
  const [rules, anomaly] = await Promise.all([
    db.alertRule.findMany({
      where: { workspaceId, enabled: true },
      orderBy: { createdAt: "desc" },
    }),
    detectWorkspaceAnomalies(workspaceId),
  ]);

  // Use the REAL p95 from anomaly detection — not an estimate
  const metrics: Record<string, number> = {
    errorRate:       anomaly.summary.errorRate,
    avgLatency:      anomaly.summary.avgLatency,
    p95Latency:      anomaly.summary.p95Latency,   // ✅ real value
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

// ---------------------------------------------------------------------------
// Notification delivery — channel-agnostic stub
// ---------------------------------------------------------------------------

export type AlertDeliveryChannel = {
  type: "webhook" | "email" | "slack";
  destination: string;
};

/**
 * Deliver a triggered alert to a configured channel.
 * Extend each branch with a real HTTP call / email SDK / Slack API.
 */
export async function deliverAlert(
  rule: AlertEvaluation["rule"],
  channel: AlertDeliveryChannel,
  currentValue: number
): Promise<{ ok: boolean; error?: string }> {
  const payload = {
    alertName: rule.name,
    severity: rule.severity,
    metric: rule.metric,
    currentValue,
    threshold: rule.threshold,
    operator: rule.operator,
    triggeredAt: new Date().toISOString(),
  };

  try {
    switch (channel.type) {
      case "webhook": {
        const res = await fetch(channel.destination, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
        return { ok: true };
      }

      case "slack": {
        const res = await fetch(channel.destination, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: `🚨 *${rule.name}* (${rule.severity.toUpperCase()}) — ${rule.metric} is ${currentValue} (threshold: ${rule.operator} ${rule.threshold})`,
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`Slack responded ${res.status}`);
        return { ok: true };
      }

      case "email": {
        // Wire to your email provider (Resend, SendGrid, AWS SES, etc.)
        console.info("[AlertDelivery] Email delivery not yet wired", { to: channel.destination, payload });
        return { ok: true };
      }

      default:
        return { ok: false, error: "Unknown channel type" };
    }
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// ---------------------------------------------------------------------------
// Convenience: evaluate + deliver all triggered rules for a workspace
// ---------------------------------------------------------------------------

export async function runAlertsForWorkspace(workspaceId: string): Promise<void> {
  const evaluations = await evaluateAlertRules(workspaceId);
  const triggered = evaluations.filter((e) => e.triggered);

  if (!triggered.length) return;

  // TODO: fetch AlertChannel rows from DB per rule and call deliverAlert.
  // For now, log to console so the wiring point is obvious.
  for (const evaluation of triggered) {
    console.info(`[Alerts] Rule "${evaluation.rule.name}" triggered — value: ${evaluation.currentValue}`);
  }
}
