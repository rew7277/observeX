import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getTraceExplorer } from "@/lib/search";
import { getWorkspaceBasic } from "@/lib/workspace";
import { db } from "@/lib/db";

export default async function TraceExplorerPage({ params, searchParams }: { params: Promise<{ workspaceId: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const sp = await searchParams;
  const traceId = typeof sp.traceId === 'string' ? sp.traceId : '';
  const traces = await db.logEvent.groupBy({ by: ['traceId'], where: { workspaceId }, _count: { _all: true }, orderBy: { _count: { traceId: 'desc' } }, take: 20 });
  const report = traceId ? await getTraceExplorer(workspaceId, traceId) : null;

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Trace explorer</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Investigate end-to-end traces</h1>
      </header>
      <Panel className="p-6">
        <form className="flex flex-wrap gap-3">
          <input name="traceId" defaultValue={traceId} className="input min-w-[320px]" placeholder="Enter trace ID" />
          <button className="btn-primary">Open trace</button>
        </form>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[0.8fr,1.2fr]">
        <Panel className="p-6">
          <div className="text-lg font-semibold">Top traces</div>
          <div className="mt-5 space-y-2">{traces.map((item) => <a key={item.traceId} href={`?traceId=${encodeURIComponent(item.traceId)}`} className="block rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"><div className="font-mono text-xs text-cyan-300 break-all">{item.traceId}</div><div className="mt-1 text-slate-400">{item._count._all} events</div></a>)}</div>
        </Panel>
        <Panel className="p-6">
          <div className="text-lg font-semibold">Trace timeline</div>
          {report ? <>
            <div className="mt-2 text-sm text-slate-400">Applications touched: {report.applications.join(', ') || '—'} • Total observed latency {report.totalLatencyMs} ms</div>
            <div className="mt-5 space-y-3">{report.steps.map((step) => <div key={step.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between gap-3"><div className="font-medium">#{step.order} • {step.application}</div><div className="text-xs text-slate-400">{new Date(step.timestamp).toLocaleString()}</div></div><div className="mt-2 text-sm text-slate-300">{step.message}</div><div className="mt-2 text-xs text-cyan-300">{step.environment} • {step.level} • {step.latencyMs} ms</div></div>)}</div>
          </> : <div className="mt-5 text-sm text-slate-400">Pick a trace ID to explore the call chain.</div>}
        </Panel>
      </div>
    </div>
  );
}
