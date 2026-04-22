import { buildSignature, detectSensitiveData } from "@/lib/security";

export type LogRecord = {
  timestamp: string;
  level: string;
  application: string;
  environment: string;
  traceId: string;
  latencyMs: number;
  message: string;
  payloadJson?: Record<string, unknown> | null;
};

type ParseOptions = {
  environmentHint?: string;
};

function normalizeTimestamp(value: unknown) {
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function cleanString(value: unknown, fallback = "") {
  const text = String(value ?? fallback).trim();
  return text || fallback;
}

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTraceId(value: unknown) {
  const text = cleanString(value);
  if (!text) return "";
  if (/^(null|undefined|na|n\/a|none|unknown)$/i.test(text)) return "";
  return text;
}

function getNestedValue(payload: any, paths: string[]) {
  for (const path of paths) {
    const parts = path.split(".");
    let current = payload;
    let ok = true;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && current != null && current !== "") return current;
  }
  return undefined;
}

function stripStructuralFields(payload: Record<string, unknown>) {
  const clone = { ...payload };
  [
    "timestamp", "time", "date", "severity", "level", "status",
    "application", "app", "service", "logger", "flowName",
    "environment", "env", "stage",
    "traceId", "trace", "eventId", "requestId", "correlationId",
    "latencyMs", "latency", "durationMs", "responseTime", "elapsedMs",
    "message", "msg", "description", "error", "exception"
  ].forEach((key) => delete clone[key]);
  return clone;
}

function summarizePayload(payload: Record<string, unknown>) {
  const directMessage = getNestedValue(payload, [
    "message",
    "msg",
    "description",
    "error",
    "exception",
    "entry.message",
    "entry.error.message",
    "entry.exception.message",
  ]);
  if (directMessage) return compactWhitespace(String(directMessage));

  const flowName = getNestedValue(payload, ["flowName", "FlowName", "entry.flowName", "entry.FlowName"]);
  const requestUri = getNestedValue(payload, ["requestUri", "requestURI", "RequestUri", "entry.requestUri"]);
  const method = getNestedValue(payload, ["method", "httpMethod", "entry.method"]);
  const status = getNestedValue(payload, ["statusCode", "status", "httpStatus", "entry.statusCode"]);
  const parts = [
    flowName ? `flow=${flowName}` : "",
    method ? `method=${method}` : "",
    requestUri ? `uri=${requestUri}` : "",
    status ? `status=${status}` : "",
  ].filter(Boolean);

  if (parts.length) return parts.join(" • ");

  const leftover = stripStructuralFields(payload);
  const preview = Object.entries(leftover)
    .slice(0, 4)
    .map(([key, value]) => `${key}=${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" • ");

  return preview || "Structured log event";
}

function normalizeObject(record: any, options?: ParseOptions): LogRecord {
  const payload = typeof record === "object" && record ? record : {};
  return {
    timestamp: normalizeTimestamp(getNestedValue(payload, ["timestamp", "time", "date", "Timestamp", "entry.timestamp"])),
    level: cleanString(getNestedValue(payload, ["level", "severity", "status", "entry.level"]), "INFO").toUpperCase(),
    application: cleanString(getNestedValue(payload, ["application", "app", "service", "logger", "flowName", "FlowName", "entry.flowName", "entry.application"]), "unknown-app"),
    environment: cleanString(getNestedValue(payload, ["environment", "env", "stage", "entry.environment"]) || options?.environmentHint, "unknown"),
    traceId: normalizeTraceId(getNestedValue(payload, ["traceId", "trace", "eventId", "requestId", "correlationId", "correlationID", "entry.traceId", "entry.requestId", "entry.correlationId"])),
    latencyMs: Math.max(0, Number(getNestedValue(payload, ["latencyMs", "latency", "durationMs", "responseTime", "elapsedMs", "entry.latencyMs"]) || 0)),
    message: summarizePayload(payload),
    payloadJson: payload
  };
}

function parseJsonInput(content: string, options?: ParseOptions): LogRecord[] | null {
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) return parsed.map((item) => normalizeObject(item, options));
    if (typeof parsed === "object" && parsed) {
      if (Array.isArray((parsed as any).records)) return (parsed as any).records.map((item: any) => normalizeObject(item, options));
      return [normalizeObject(parsed, options)];
    }
    return null;
  } catch {
    return null;
  }
}

function parseJsonLines(content: string, options?: ParseOptions): LogRecord[] | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;

  const rows: LogRecord[] = [];
  for (const line of lines) {
    if (!line.startsWith("{") || !line.endsWith("}")) return null;
    try {
      rows.push(normalizeObject(JSON.parse(line), options));
    } catch {
      return null;
    }
  }
  return rows;
}

function extractEmbeddedJsonObjects(content: string, options?: ParseOptions): LogRecord[] {
  const lines = content.split(/\r?\n/);
  const rows: LogRecord[] = [];
  let buffer: string[] = [];
  let depth = 0;
  let started = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const opens = (line.match(/[\[{]/g) || []).length;
    const closes = (line.match(/[\]}]/g) || []).length;

    if (!started && (line.startsWith("{") || line.startsWith("["))) {
      started = true;
      buffer = [line];
      depth = opens - closes;
      if (depth <= 0) {
        try {
          const parsed = JSON.parse(buffer.join("\n"));
          if (Array.isArray(parsed)) {
            rows.push(...parsed.filter((item) => item && typeof item === "object").map((item) => normalizeObject(item, options)));
          } else if (parsed && typeof parsed === "object") {
            rows.push(normalizeObject(parsed, options));
          }
        } catch {}
        buffer = [];
        started = false;
        depth = 0;
      }
      continue;
    }

    if (started) {
      buffer.push(line);
      depth += opens - closes;
      if (depth <= 0) {
        try {
          const parsed = JSON.parse(buffer.join("\n"));
          if (Array.isArray(parsed)) {
            rows.push(...parsed.filter((item) => item && typeof item === "object").map((item) => normalizeObject(item, options)));
          } else if (parsed && typeof parsed === "object") {
            rows.push(normalizeObject(parsed, options));
          }
        } catch {}
        buffer = [];
        started = false;
        depth = 0;
      }
    }
  }

  return rows;
}

function inferApplication(line: string) {
  const patterns = [
    /app(?:lication)?[=:]\s*([A-Za-z0-9._/-]+)/i,
    /service[=:]\s*([A-Za-z0-9._/-]+)/i,
    /flow(?:Name)?[=:]\s*([A-Za-z0-9._/-]+)/i,
    /logger[=:]\s*([A-Za-z0-9._/-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(line);
    if (match?.[1]) return match[1];
  }
  return "unknown-app";
}

function inferEnvironment(line: string) {
  const match = /\b(prod(?:uction)?|uat|dev(?:elopment)?|dr|qa|sit)\b/i.exec(line);
  return match?.[1]?.toUpperCase();
}

function inferTrace(line: string) {
  const match = /(?:traceId|trace|requestId|eventId|correlationId|correlationID)[=:]\s*([A-Za-z0-9._:-]+)/i.exec(line);
  return match?.[1] || "";
}

function inferLatency(line: string) {
  const match = /(?:latency|responseTime|duration|elapsed(?:Ms)?)\s*[=:]\s*(\d+)/i.exec(line);
  return match?.[1];
}

function parsePlainText(content: string, options?: ParseOptions): LogRecord[] {
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const regex = /^(?<timestamp>\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z)?)?\s*(?:\[(?<level>[A-Z]+)\])?\s*(?:\[(?<application>[^\]]+)\])?\s*(?:\[(?<environment>[^\]]+)\])?\s*(?:trace(?:Id)?=(?<traceId>[^\s]+))?\s*(?:latency(?:Ms)?=(?<latencyMs>\d+))?\s*(?:message=)?(?<message>.*)$/i;

  return lines.map((line) => {
    const match = regex.exec(line);
    const level = match?.groups?.level || (/error|exception|failed/i.test(line) ? "ERROR" : /warn/i.test(line) ? "WARN" : "INFO");
    const application = match?.groups?.application || inferApplication(line);
    const environment = match?.groups?.environment || inferEnvironment(line) || options?.environmentHint || "unknown";
    const timestamp = normalizeTimestamp(match?.groups?.timestamp);
    const traceId = normalizeTraceId(match?.groups?.traceId || inferTrace(line));
    const message = compactWhitespace((match?.groups?.message || line).trim());

    return {
      timestamp,
      level: level.toUpperCase(),
      application,
      environment,
      traceId,
      latencyMs: Number(match?.groups?.latencyMs || inferLatency(line) || 0),
      message,
      payloadJson: { raw: line }
    };
  });
}

function percentile(values: number[], pct: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((pct / 100) * sorted.length) - 1));
  return sorted[idx];
}

export function parseLogs(content: string, options?: ParseOptions): {
  sourceType: string;
  records: LogRecord[];
  parserHints: { detectedFormat: string; foundTraceIds: boolean; foundLatency: boolean; structuredBlocks: boolean };
  quality: { invalidRowsApprox: number; emptyInput: boolean };
} {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      sourceType: "empty",
      records: [],
      parserHints: { detectedFormat: "empty", foundTraceIds: false, foundLatency: false, structuredBlocks: false },
      quality: { invalidRowsApprox: 0, emptyInput: true }
    };
  }

  const jsonArray = parseJsonInput(trimmed, options);
  const jsonLines = jsonArray ? null : parseJsonLines(trimmed, options);
  const embeddedJson = !jsonArray && !jsonLines ? extractEmbeddedJsonObjects(trimmed, options) : [];
  const plain = !jsonArray && !jsonLines && embeddedJson.length === 0 ? parsePlainText(trimmed, options) : [];
  const records = jsonArray || jsonLines || embeddedJson || plain;
  const sourceType = jsonArray ? "json" : jsonLines ? "jsonl" : embeddedJson.length ? "structured-text" : "text";

  return {
    sourceType,
    records,
    parserHints: {
      detectedFormat: sourceType,
      foundTraceIds: records.some((r) => Boolean(r.traceId)),
      foundLatency: records.some((r) => r.latencyMs > 0),
      structuredBlocks: embeddedJson.length > 0,
    },
    quality: {
      invalidRowsApprox: 0,
      emptyInput: false
    }
  };
}

export function buildMetrics(records: LogRecord[]) {
  const total = records.length;
  const latencies = records.map((row) => row.latencyMs).filter((n) => Number.isFinite(n) && n >= 0);
  const avgLatency = total ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / Math.max(latencies.length, 1)) : 0;
  const p95Latency = percentile(latencies, 95);
  const p99Latency = percentile(latencies, 99);
  const errorCount = records.filter((r) => r.level === "ERROR").length;
  const warnCount = records.filter((r) => r.level === "WARN").length;
  const piiEvents = records.filter((r) => detectSensitiveData(r.message).containsPii).length;
  const alertCount = errorCount + warnCount;
  const errorRate = total ? Number(((errorCount / total) * 100).toFixed(1)) : 0;

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
  ).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const timelineMap = records.reduce<Record<string, { errors: number; warns: number; totalLatency: number; count: number }>>((acc, row) => {
    const hour = String(row.timestamp).slice(0, 13).replace("T", " ") + ":00";
    acc[hour] = acc[hour] || { errors: 0, warns: 0, totalLatency: 0, count: 0 };
    if (row.level === "ERROR") acc[hour].errors += 1;
    if (row.level === "WARN") acc[hour].warns += 1;
    acc[hour].totalLatency += row.latencyMs;
    acc[hour].count += 1;
    return acc;
  }, {});

  const timeline = Object.entries(timelineMap).map(([time, item]) => ({
    time,
    errors: item.errors,
    warns: item.warns,
    avgLatency: item.count ? Math.round(item.totalLatency / item.count) : 0
  })).sort((a, b) => a.time.localeCompare(b.time));

  const traceMap = records.reduce<Record<string, number>>((acc, row) => {
    if (!row.traceId) return acc;
    acc[row.traceId] = (acc[row.traceId] || 0) + 1;
    return acc;
  }, {});

  const busiestTraces = Object.entries(traceMap)
    .map(([traceId, count]) => ({ traceId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const slowestApplications = [...applications].map((app) => {
    const appRows = records.filter((row) => row.application === app.name);
    const avg = appRows.length ? Math.round(appRows.reduce((sum, row) => sum + row.latencyMs, 0) / appRows.length) : 0;
    return { name: app.name, avgLatency: avg, count: app.value };
  }).sort((a, b) => b.avgLatency - a.avgLatency).slice(0, 6);

  const signatureMap = records.reduce<Record<string, number>>((acc, row) => {
    if (row.level !== "ERROR" && row.level !== "WARN") return acc;
    const signature = buildSignature(row.message);
    acc[signature] = (acc[signature] || 0) + 1;
    return acc;
  }, {});

  const topSignatures = Object.entries(signatureMap)
    .map(([signature, count]) => ({ signature, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const anomalySignals = [
    ...(errorRate > 5 ? [{ label: "Error rate spike", value: `${errorRate}%` }] : []),
    ...(p95Latency > 400 ? [{ label: "P95 latency elevated", value: `${p95Latency} ms` }] : []),
    ...(piiEvents > 0 ? [{ label: "Sensitive data detected", value: `${piiEvents} events` }] : [])
  ];

  const health = errorRate === 0 && warnCount === 0 ? "Healthy" : errorRate < 8 ? "Watch" : "Critical";

  return {
    totalLogs: total,
    avgLatency,
    p95Latency,
    p99Latency,
    errorCount,
    warnCount,
    piiEvents,
    alertCount,
    errorRate,
    health,
    levels,
    environments,
    applications,
    timeline,
    busiestTraces,
    slowestApplications,
    topSignatures,
    anomalySignals
  };
}
