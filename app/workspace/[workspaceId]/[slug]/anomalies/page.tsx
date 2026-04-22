import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { detectWorkspaceAnomalies } from "@/lib/anomaly";
import { getWorkspaceBasic } from "@/lib/workspace";

export default async function AnomaliesPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const report = await detectWorkspaceAnomalies(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Detection engine</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Anomaly detection</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">This workspace now surfaces error spikes, fatal patterns, latency drift, and PII/secret exposure signals from indexed log traffic.</p>
      </header>
      <div className="grid gap-5 md:grid-cols-4">
        {[
          ["Events analysed", report.summary.totalEvents],
          ["Error rate", `${report.summary.errorRate}%`],
          ["Avg latency", `${report.summary.avgLatency} ms`],
          ["PII events", report.summary.piiEvents],
        ].map(([label, value]) => <Panel key={String(label)} className="p-5"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></Panel>)}
      </div>
      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">Detected signals</div>
        <div className="mt-5 space-y-3">
          {report.anomalies.map((item, index) => (
            <div key={index} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{item.title}</div>
                <div className="rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide">{item.severity}</div>
              </div>
              <div className="mt-2 text-sm text-slate-300">{item.detail}</div>
              <div className="mt-2 text-xs text-cyan-300">{item.metric}</div>
            </div>
          ))}
          {!report.anomalies.length ? <div className="text-sm text-slate-400">No anomalies detected from the recent window.</div> : null}
        </div>
      </Panel>
    </div>
  );
}
