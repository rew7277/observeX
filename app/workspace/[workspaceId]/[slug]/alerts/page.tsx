import { Panel } from "@/components/panel";
import { AlertRuleForm } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function AlertsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Alerts center</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Rules, thresholds, and investigation context</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">This version includes rule storage plus a dashboard view that derives current signals from your uploaded data.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">Create alert rule</div>
        <div className="mt-4"><AlertRuleForm workspaceId={workspaceId} /></div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Current signal summary</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Errors", metrics.errorCount],
              ["Warnings", metrics.warnCount],
              ["Alertable signals", metrics.alertCount],
              ["Error rate", `${metrics.errorRate}%`]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Saved rules</div>
          <div className="mt-5 space-y-3">
            {workspace.alertRules.map((rule) => (
              <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{rule.metric} {rule.operator} {rule.threshold} • {rule.severity}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs ${rule.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-300"}`}>{rule.enabled ? "Enabled" : "Paused"}</div>
                </div>
              </div>
            ))}
            {!workspace.alertRules.length ? <div className="text-sm text-slate-400">No alert rules yet.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
