import { db } from "@/lib/db";

// ---------------------------------------------------------------------------
// AI-powered incident summary using Anthropic API
// ---------------------------------------------------------------------------

async function callClaude(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? "";
  } catch {
    return "";
  }
}

export async function buildIncidentSummary(workspaceId: string) {
  const events = await db.logEvent.findMany({
    where: { workspaceId, OR: [{ level: { contains: "ERROR", mode: "insensitive" } }, { level: { contains: "FATAL", mode: "insensitive" } }] },
    orderBy: { timestamp: "desc" },
    take: 150,
    select: { application: true, signature: true, message: true, level: true, timestamp: true, environment: true },
  });

  const applications = Array.from(new Set(events.map((e) => e.application)));
  const signatures = Array.from(new Set(events.map((e) => e.signature))).slice(0, 5);
  const candidateRootCause = signatures[0] || "No dominant error signature yet";

  // Build static summary (always available)
  const staticSummary = {
    headline: events.length ? `Investigate ${events.length} recent error events across ${applications.length} app(s)` : "No active incident indicators right now",
    probableCause: candidateRootCause,
    applications,
    nextSteps: [
      "Validate the top repeated signature in trace explorer.",
      "Compare latency and errors across environments.",
      "Check whether any connector sync or deployment happened before the spike.",
      "Review flagged PII/secret events before exporting logs externally.",
    ],
    aiSummary: null as string | null,
  };

  if (!events.length) return staticSummary;

  // AI-powered summary — gracefully degrades if no API key
  const topErrors = events.slice(0, 20).map((e) => `[${e.level}] ${e.application} (${e.environment}): ${e.message.slice(0, 120)}`).join("\n");
  const prompt = `You are an SRE assistant. Analyze these recent error log events and provide a concise (3-4 sentence) incident summary. Identify the most likely root cause, affected services, and one concrete remediation step. Be direct and technical.

Recent errors:
${topErrors}

Respond with plain text only, no markdown headers.`;

  const aiSummary = await callClaude(prompt);

  return { ...staticSummary, aiSummary: aiSummary || null };
}

// ---------------------------------------------------------------------------
// AI root-cause analysis for a specific error signature
// ---------------------------------------------------------------------------

export async function explainSignature(signature: string, exampleMessages: string[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return "";

  const examples = exampleMessages.slice(0, 5).map((m, i) => `${i + 1}. ${m.slice(0, 150)}`).join("\n");
  const prompt = `You are an expert software engineer. Given this error pattern and example log messages, explain in 2-3 sentences what is likely causing this error and how to fix it.

Error pattern: "${signature}"
Example occurrences:
${examples}

Be specific and actionable. Plain text only.`;

  return callClaude(prompt);
}
