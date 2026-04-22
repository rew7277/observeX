import { db } from "@/lib/db";

export async function buildIncidentSummary(workspaceId: string) {
  const events = await db.logEvent.findMany({
    where: { workspaceId, OR: [{ level: { contains: "ERROR", mode: "insensitive" } }, { level: { contains: "FATAL", mode: "insensitive" } }] },
    orderBy: { timestamp: "desc" },
    take: 150,
  });

  const applications = Array.from(new Set(events.map((event) => event.application)));
  const signatures = Array.from(new Set(events.map((event) => event.signature))).slice(0, 5);
  const candidateRootCause = signatures[0] || "No dominant error signature yet";

  return {
    headline: events.length ? `Investigate ${events.length} recent error events across ${applications.length} app(s)` : "No active incident indicators right now",
    probableCause: candidateRootCause,
    applications,
    nextSteps: [
      "Validate the top repeated signature in trace explorer.",
      "Compare latency and errors across environments.",
      "Check whether any connector sync or deployment happened before the spike.",
      "Review flagged PII/secret events before exporting logs externally.",
    ],
  };
}
