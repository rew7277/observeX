import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";
import { AlertTriangle, GitBranch, Info, Search } from "lucide-react";

function normaliseMessageKey(message: string) {
  return message.replace(/\b[\da-f-]{6,}\b/gi, "?").replace(/\s+/g, " ").trim().slice(0, 120);
}

export default async function FlowAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { metrics, records } = await getWorkspaceContext(workspaceId, slug, user.id);
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const filtered = q
    ? records.filter((r) => [r.application, r.environment, r.traceId, r.message, r.level].join(" ").toLowerCase().includes(q))
    : records;

  const realTraceRecords = filtered.filter((r) => Boolean(r.traceId));
  const traceCounts = Object.entries(
    realTraceRecords.reduce<Record<string, number>>((acc, row) => {
      acc[row.traceId] = (acc[row.traceId] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([traceId, count]) => ({ traceId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const appTransitions = filtered.reduce<Record<string, number>>((acc, row, index) => {
    const next = filtered[index + 1];
    if (!next) return acc;
    if (row.application === next.application) return acc;
    const sameTrace = row.traceId && next.traceId && row.traceId === next.traceId;
    const closeInTime = Math.abs(new Date(next.timestamp).getTime() - new Date(row.timestamp).getTime()) <= 5 * 60 * 1000;
    if (sameTrace || closeInTime) {
      const key = `${row.application} → ${next.application}`;
      acc[key] = (acc[key] || 0) + 1;
    }
    return acc;
  }, {});

  const topTransitions = Object.entries(appTransitions)
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const errorsByApp = filtered
    .filter((r) => r.level === "ERROR")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.application] = (acc[r.application] || 0) + 1;
      return acc;
    }, {});
  const topErrorApps = Object.entries(errorsByApp)
    .map(([app, count]) => ({ app, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const errorMessages = filtered
    .filter((r) => r.level === "ERROR" || r.level === "WARN")
    .reduce<Record<string, { count: number; level: string }>>((acc, r) => {
      const key = normaliseMessageKey(r.message);
      acc[key] = acc[key] || { count: 0, level: r.level };
      acc[key].count += 1;
      return acc;
    }, {});
  const topErrors = Object.entries(errorMessages)
    .map(([msg, { count, level }]) => ({ msg, count, level }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const slowestApplications = metrics.slowestApplications.filter((item) => !q || item.name.toLowerCase().includes(q)).slice(0, 8);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge">
          <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Flow analytics
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Searchable flow and hotspot analysis</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
          Search by application, message, environment, or trace ID. The page now avoids fake traces and falls back to real flow transitions when trace IDs are missing.
        </p>
      </header>

      <Panel className="p-5 md:p-6">
        <form className="flex flex-wrap gap-3">
          <div className="relative min-w-[280px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input name="q" defaultValue={q} className="input pl-9" placeholder="Search app, flow, trace ID, message..." />
          </div>
          <button className="btn-primary">Analyse</button>
          {q ? <a href="?" className="btn-secondary">Clear</a> : null}
        </form>
        <div className="mt-3 text-xs text-slate-500">Showing analysis for {filtered.length.toLocaleString()} matching records.</div>
      </Panel>

      {!traceCounts.length && filtered.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <div>
            <div className="font-semibold">No real trace IDs found in these records</div>
            <div className="mt-1 text-amber-200/70">
              The uploaded logs do not expose stable trace/request/correlation IDs for this result set, so flow analysis is using application transitions and repeated message clusters instead.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Busiest real traces</div>
          <div className="mt-1 text-xs text-slate-400 mb-5">Only actual trace/request/correlation IDs from the log data</div>
          <div className="space-y-3">
            {traceCounts.map((item, i) => (
              <div key={item.traceId} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="w-5 text-xs text-slate-500 font-mono shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-mono text-sm text-cyan-300">{item.traceId}</div>
                  <div className="mt-0.5 text-xs text-slate-400">Trace occurrences in uploaded data</div>
                </div>
                <div className="text-lg font-semibold shrink-0">{item.count}</div>
              </div>
            ))}
            {!traceCounts.length && <div className="text-sm text-slate-400">No real trace IDs available for the current filter.</div>}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-violet-300" />
            <div className="text-lg font-semibold">Top flow transitions</div>
          </div>
          <div className="mt-1 text-xs text-slate-400 mb-5">Most repeated application-to-application jumps in the matching records</div>
          <div className="space-y-3">
            {topTransitions.map((item, i) => (
              <div key={item.path} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="w-5 text-xs text-slate-500 font-mono shrink-0">#{i + 1}</span>
                <div className="flex-1 truncate font-medium">{item.path}</div>
                <div className="text-lg font-semibold text-violet-300 shrink-0">{item.count}</div>
              </div>
            ))}
            {!topTransitions.length && <div className="text-sm text-slate-400">Not enough structured sequence data to build transitions yet.</div>}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Slowest applications</div>
          <div className="mt-1 text-xs text-slate-400 mb-5">Average latency per service</div>
          <div className="space-y-3">
            {slowestApplications.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="w-5 text-xs text-slate-500 font-mono shrink-0">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{item.name}</div>
                  <div className="mt-0.5 text-xs text-slate-400">{item.count.toLocaleString()} records analysed</div>
                </div>
                <div className={`text-lg font-semibold shrink-0 ${item.avgLatency > 500 ? "text-rose-400" : item.avgLatency > 200 ? "text-amber-300" : "text-emerald-300"}`}>{item.avgLatency} ms</div>
              </div>
            ))}
            {!slowestApplications.length && <div className="text-sm text-slate-400">No latency data found for the current filter.</div>}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            <div className="text-lg font-semibold">Errors by application</div>
          </div>
          <div className="mt-1 text-xs text-slate-400 mb-5">Which services are generating the most errors</div>
          <div className="space-y-3">
            {topErrorApps.map((item, i) => (
              <div key={item.app} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <span className="w-5 text-xs text-slate-500 font-mono shrink-0">#{i + 1}</span>
                <div className="flex-1 truncate font-medium">{item.app}</div>
                <div className="text-lg font-semibold text-rose-400 shrink-0">{item.count.toLocaleString()}</div>
                <div className="text-xs text-slate-500 shrink-0">errors</div>
              </div>
            ))}
            {!topErrorApps.length && <div className="flex items-center gap-2 text-sm text-emerald-300"><span>✓</span> No errors found in the current result set</div>}
          </div>
        </Panel>
      </div>

      {topErrors.length > 0 && (
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Top repeated error/warn messages</div>
          <div className="mt-1 text-xs text-slate-400 mb-5">Most frequent error and warning clusters after normalising IDs and hashes</div>
          <div className="space-y-2">
            {topErrors.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <span className="w-5 shrink-0 text-xs text-slate-500 font-mono mt-0.5">#{i + 1}</span>
                <span className={`shrink-0 mt-0.5 inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold ring-1 ${item.level === "ERROR" ? "text-rose-400 bg-rose-400/10 ring-rose-400/30" : "text-amber-300 bg-amber-400/10 ring-amber-400/30"}`}>{item.level}</span>
                <div className="flex-1 min-w-0"><div className="truncate text-sm text-slate-200" title={item.msg}>{item.msg}</div></div>
                <div className="shrink-0 text-right"><div className="font-semibold text-slate-200">{item.count.toLocaleString()}</div><div className="text-[10px] text-slate-500">occurrences</div></div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {records.length === 0 && <Panel className="p-10 text-center text-sm text-slate-400">Upload log files to see flow analytics and trace hotspot data.</Panel>}
    </div>
  );
}
