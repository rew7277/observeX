import { Panel } from "@/components/panel";
import { AlertRuleForm, AlertChannelForm } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";
import { evaluateAlertRules } from "@/lib/alerts-engine";

export default async function AlertsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics } = await getWorkspaceContext(workspaceId, slug, user.id);
  const evaluations = await evaluateAlertRules(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Alerts center</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Rules, channels & delivery</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Create alert rules, configure notification channels (Slack, webhook, email), and see live rule evaluations.</p>
      </header>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Create alert rule</div>
          <div className="mt-4"><AlertRuleForm workspaceId={workspaceId} /></div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Add notification channel</div>
          <div className="mt-1 text-sm text-slate-400">Deliver triggered alerts to Slack, webhook, or email</div>
          <div className="mt-4"><AlertChannelForm workspaceId={workspaceId} /></div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Signal snapshot</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[["Errors", metrics.errorCount], ["Warnings", metrics.warnCount], ["Alert count", metrics.alertCount], ["Error rate", `${metrics.errorRate}%`]].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Live rule evaluation</div>
          <div className="mt-5 space-y-3">
            {evaluations.map(({ rule, currentValue, triggered }) => (
              <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{rule.metric} {rule.operator} {rule.threshold} · {rule.severity}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs ${triggered ? "bg-rose-500/20 text-rose-300" : "bg-emerald-500/20 text-emerald-300"}`}>{triggered ? "🔴 Triggered" : "✅ OK"}</div>
                </div>
                <div className="mt-2 text-sm text-slate-300">Current: <span className="font-mono text-cyan-300">{currentValue}</span></div>
              </div>
            ))}
            {!evaluations.length && <div className="text-sm text-slate-400">No active rules yet. Create one above.</div>}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Notification channels</div>
          <div className="mt-5 space-y-3">
            {(workspace as any).alertChannels?.map((ch: any) => (
              <div key={ch.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{ch.name}</div>
                    <div className="mt-1 text-xs text-slate-400 capitalize">{ch.type} · {ch.destination.slice(0, 40)}{ch.destination.length > 40 ? "…" : ""}</div>
                  </div>
                  <div className={`rounded-full px-2 py-0.5 text-xs ${ch.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-500/20 text-slate-400"}`}>{ch.enabled ? "Active" : "Paused"}</div>
                </div>
              </div>
            ))}
            {!(workspace as any).alertChannels?.length && <div className="text-sm text-slate-400">No channels configured. Add one above.</div>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
