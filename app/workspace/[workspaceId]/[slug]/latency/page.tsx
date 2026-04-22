import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getLatencyInsights } from "@/lib/latency";
import { getWorkspaceBasic } from "@/lib/workspace";

export default async function LatencyPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const report = await getLatencyInsights(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Performance analytics</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Latency percentile dashboard</h1>
      </header>
      <div className="grid gap-5 md:grid-cols-5">
        {Object.entries(report.percentiles).map(([label, value]) => <Panel key={label} className="p-5"><div className="text-xs uppercase tracking-wide text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value} ms</div></Panel>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-6">
          <div className="text-lg font-semibold">Environment comparison</div>
          <div className="mt-5 space-y-3">{report.environments.map((item) => <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><div><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">Average {item.avg} ms</div></div><div className="text-cyan-300 font-semibold">P95 {item.p95} ms</div></div>)}</div>
        </Panel>
        <Panel className="p-6">
          <div className="text-lg font-semibold">Slowest applications</div>
          <div className="mt-5 space-y-3">{report.applications.map((item) => <div key={item.name} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><div><div className="font-medium">{item.name}</div><div className="text-xs text-slate-400">Average {item.avg} ms</div></div><div className="text-amber-300 font-semibold">P95 {item.p95} ms</div></div>)}</div>
        </Panel>
      </div>
    </div>
  );
}
