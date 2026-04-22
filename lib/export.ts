import { db } from "@/lib/db";

export async function exportWorkspaceEvents(workspaceId: string, format: "json" | "csv" = "json") {
  const events = await db.logEvent.findMany({ where: { workspaceId }, orderBy: { timestamp: "desc" }, take: 5000 });
  if (format === "json") {
    return JSON.stringify(events, null, 2);
  }

  const header = ["timestamp","level","application","environment","traceId","latencyMs","containsPii","message"];
  const rows = events.map((event) => [
    event.timestamp.toISOString(),
    event.level,
    event.application,
    event.environment,
    event.traceId,
    String(event.latencyMs || 0),
    String(event.containsPii),
    `"${String(event.message).replace(/"/g, '""')}"`,
  ].join(","));
  return [header.join(","), ...rows].join("\n");
}
