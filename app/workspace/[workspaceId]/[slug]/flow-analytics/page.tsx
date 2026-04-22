import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function FlowAnalyticsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { metrics } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Flow analytics</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Trace and dependency hotspots</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">See which traces are busiest and which applications are slowest based on your uploaded logs.</p>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Busiest traces</div>
          <div className="mt-5 space-y-3">
            {metrics.busiestTraces.map((item) => (
              <div key={item.traceId} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <div className="font-medium text-cyan-300">{item.traceId}</div>
                  <div className="mt-1 text-xs text-slate-400">Trace occurrences in uploaded data</div>
                </div>
                <div className="text-lg font-semibold">{item.count}</div>
              </div>
            ))}
            {!metrics.busiestTraces.length ? <div className="text-sm text-slate-400">Upload logs to calculate trace hot paths.</div> : null}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Slowest applications</div>
          <div className="mt-5 space-y-3">
            {metrics.slowestApplications.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <div className="font-medium">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{item.count} records analysed</div>
                </div>
                <div className="text-lg font-semibold">{item.avgLatency} ms</div>
              </div>
            ))}
            {!metrics.slowestApplications.length ? <div className="text-sm text-slate-400">Upload logs to identify slow services.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
