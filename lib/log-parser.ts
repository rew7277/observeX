export type LogRecord = {
  timestamp: string;
  level: string;
  application: string;
  environment: string;
  traceId: string;
  latencyMs: number;
  message: string;
};

function normalizeObject(record: any): LogRecord {
  return {
    timestamp:
      record.timestamp ||
      record.time ||
      record.date ||
      new Date().toISOString(),
    level: String(record.level || record.severity || "INFO").toUpperCase(),
    application: String(record.application || record.app || record.service || "unknown-app"),
    environment: String(record.environment || record.env || "unknown"),
    traceId: String(record.traceId || record.trace || record.eventId || `TRC-${Math.random().toString(36).slice(2, 8).toUpperCase()}`),
    latencyMs: Number(record.latencyMs || record.latency || record.durationMs || 0),
    message: String(record.message || record.msg || record.description || "No message")
  };
}

function parseJsonInput(content: string): LogRecord[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map(normalizeObject);
    if (typeof parsed === "object" && parsed) return [normalizeObject(parsed)];
    return null;
  } catch {
    return null;
  }
}

function parseJsonLines(content: string): LogRecord[] | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const rows: LogRecord[] = [];
  for (const line of lines) {
    if (!line.startsWith("{") || !line.endsWith("}")) return null;
    try {
      rows.push(normalizeObject(JSON.parse(line)));
    } catch {
      return null;
    }
  }
  return rows;
}

function parsePlainText(content: string): LogRecord[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const regex =
    /^(?<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2})(?:\.\d+)?\s*(?:\[(?<level>[A-Z]+)\])?\s*(?:\[(?<application>[^\]]+)\])?\s*(?:\[(?<environment>[^\]]+)\])?\s*(?:trace(?:Id)?=(?<traceId>[^\s]+))?\s*(?:latency(?:Ms)?=(?<latencyMs>\d+))?\s*(?:message=)?(?:"(?<messageQuoted>.*)"|(?<message>.*))$/i;

  return lines.map((line, index) => {
    const match = regex.exec(line);
    if (match?.groups) {
      return {
        timestamp: match.groups.timestamp || new Date().toISOString(),
        level: (match.groups.level || "INFO").toUpperCase(),
        application: match.groups.application || "unknown-app",
        environment: match.groups.environment || "unknown",
        traceId: match.groups.traceId || `TRC-${String(index + 1).padStart(5, "0")}`,
        latencyMs: Number(match.groups.latencyMs || 0),
        message: (match.groups.messageQuoted || match.groups.message || line).trim()
      };
    }

    return {
      timestamp: new Date().toISOString(),
      level: /error/i.test(line) ? "ERROR" : /warn/i.test(line) ? "WARN" : "INFO",
      application: "unknown-app",
      environment: "unknown",
      traceId: `TRC-${String(index + 1).padStart(5, "0")}`,
      latencyMs: 0,
      message: line
    };
  });
}

export function parseLogs(content: string): { sourceType: string; records: LogRecord[] } {
  const jsonArray = parseJsonInput(content);
  if (jsonArray) return { sourceType: "json", records: jsonArray };

  const jsonLines = parseJsonLines(content);
  if (jsonLines) return { sourceType: "jsonl", records: jsonLines };

  return { sourceType: "text", records: parsePlainText(content) };
}

export function buildMetrics(records: LogRecord[]) {
  const total = records.length;
  const avgLatency = total ? Math.round(records.reduce((sum, row) => sum + row.latencyMs, 0) / total) : 0;
  const levels = Object.entries(
    records.reduce<Record<string, number>>((acc, row) => {
      acc[row.level] = (acc[row.level] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const environments = Object.entries(
    records.reduce<Record<string, number>>((acc, row) => {
      acc[row.environment] = (acc[row.environment] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  const applications = Object.entries(
    records.reduce<Record<string, number>>((acc, row) => {
      acc[row.application] = (acc[row.application] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const timelineMap = records.reduce<Record<string, { errors: number; totalLatency: number; count: number }>>((acc, row) => {
    const hour = String(row.timestamp).slice(0, 13).replace("T", " ") + ":00";
    acc[hour] = acc[hour] || { errors: 0, totalLatency: 0, count: 0 };
    if (row.level === "ERROR") acc[hour].errors += 1;
    acc[hour].totalLatency += row.latencyMs;
    acc[hour].count += 1;
    return acc;
  }, {});

  const timeline = Object.entries(timelineMap).map(([time, item]) => ({
    time,
    errors: item.errors,
    avgLatency: item.count ? Math.round(item.totalLatency / item.count) : 0
  }));

  const alertCount = records.filter((r) => ["ERROR", "WARN"].includes(r.level)).length;
  const health = alertCount === 0 ? "Healthy" : alertCount < Math.max(3, Math.ceil(total * 0.15)) ? "Watch" : "Critical";

  return {
    totalLogs: total,
    avgLatency,
    alertCount,
    health,
    levels,
    environments,
    applications,
    timeline
  };
}
