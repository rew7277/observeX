import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getTraceExplorer } from "@/lib/search";
import { getWorkspaceBasic } from "@/lib/workspace";
import { db } from "@/lib/db";
import { Search } from "lucide-react";

export default async function TraceExplorerPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const sp = await searchParams;
  const traceId = typeof sp.traceId === "string" ? sp.traceId.trim() : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = {
    workspaceId,
    ...(q
      ? {
          OR: [
            { traceId: { contains: q } },
            { application: { contains: q, mode: "insensitive" as const } },
            { message: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const traces = await db.logEvent.groupBy({
    by: ["traceId"],
    where: { ...where, traceId: { not: "" } },
    _count: { _all: true },
    orderBy: { _count: { traceId: "desc" } },
    take: 20,
  });

  const fallbackEvents = !traces.length
    ? await db.logEvent.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: 20,
      })
    : [];

  const report = traceId ? await getTraceExplorer(workspaceId, traceId) : null;

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Trace explorer</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Investigate end-to-end traces</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
          Search for a real trace ID, request ID, correlation ID, application, or message fragment. If the logs do not contain trace IDs, the page falls back to searchable raw events instead of showing fake traces.
        </p>
      </header>
      <Panel className="p-6">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input name="traceId" defaultValue={traceId} className="input pl-9" placeholder="Enter real trace/request/correlation ID" />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Filter list by application or message" />
          </div>
          <button className="btn-primary">Open trace</button>
        </form>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[0.8fr,1.2fr]">
        <Panel className="p-6">
          <div className="text-lg font-semibold">Real trace IDs</div>
          <div className="mt-5 space-y-2">
            {traces.map((item) => (
              <a key={item.traceId} href={`?traceId=${encodeURIComponent(item.traceId)}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
                <div className="font-mono text-xs text-cyan-300 break-all">{item.traceId}</div>
                <div className="mt-1 text-slate-400">{item._count._all} events</div>
              </a>
            ))}
            {!traces.length && (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4 text-sm text-amber-200">
                No real trace IDs were found for this workspace/filter. Search the fallback event list to inspect the raw records instead.
              </div>
            )}
            {!traces.length && fallbackEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
                <div className="font-medium truncate">{event.application}</div>
                <div className="mt-1 text-xs text-slate-400 truncate">{event.message}</div>
                <div className="mt-1 text-[10px] text-slate-500">{event.environment} • {event.level}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-6">
          <div className="text-lg font-semibold">Trace timeline</div>
          {report ? (
            <>
              <div className="mt-2 text-sm text-slate-400">Applications touched: {report.applications.join(", ") || "—"} • Total observed latency {report.totalLatencyMs} ms</div>
              <div className="mt-5 space-y-3">
                {report.steps.map((step) => (
                  <div key={step.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">#{step.order} • {step.application}</div>
                      <div className="text-xs text-slate-400">{new Date(step.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="mt-2 text-sm text-slate-300 whitespace-pre-wrap break-words">{step.message}</div>
                    <div className="mt-2 text-xs text-cyan-300">{step.environment} • {step.level} • {step.latencyMs} ms</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-5 text-sm text-slate-400">Pick a real trace ID to explore the call chain. When your logs do not contain trace IDs, use the flow analytics page for application transition analysis instead.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
