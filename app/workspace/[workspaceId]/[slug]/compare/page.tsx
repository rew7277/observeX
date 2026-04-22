import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getLatencyInsights } from "@/lib/latency";
import { getWorkspaceBasic } from "@/lib/workspace";

export default async function ComparePage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const report = await getLatencyInsights(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Environment compare</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Cross-environment comparison</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Use this page to spot DEV/UAT/PROD differences in latency and stability before rollout or rollback decisions.</p>
      </header>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Current comparison snapshot</div>
        <div className="mt-5 grid gap-3">{report.environments.map((item) => <div key={item.name} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex items-center justify-between"><div className="font-medium">{item.name}</div><div className="text-sm text-slate-400">Avg {item.avg} ms</div></div><div className="mt-2 text-xl font-semibold text-cyan-300">P95 {item.p95} ms</div></div>)}</div>
      </Panel>
    </div>
  );
}
