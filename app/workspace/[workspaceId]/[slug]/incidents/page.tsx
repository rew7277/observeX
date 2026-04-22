import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { buildIncidentSummary } from "@/lib/ai-summary";
import { evaluateAlertRules } from "@/lib/alerts-engine";
import { getWorkspaceBasic } from "@/lib/workspace";

export default async function IncidentsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const summary = await buildIncidentSummary(workspaceId);
  const evaluations = await evaluateAlertRules(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Incident center</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Incident timeline & RCA summary</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">A focused incident view with probable cause hints, alert-rule evaluation, and next-step guidance for ops teams.</p>
      </header>
      <Panel className="p-6">
        <div className="text-lg font-semibold">AI-style incident brief</div>
        <div className="mt-4 text-2xl font-semibold">{summary.headline}</div>
        <div className="mt-3 text-sm text-slate-300">Probable root cause: <span className="text-cyan-300">{summary.probableCause}</span></div>
        <div className="mt-4 flex flex-wrap gap-2">{summary.applications.map((app) => <span key={app} className="rounded-full bg-white/10 px-3 py-1 text-xs">{app}</span>)}</div>
        <div className="mt-5 space-y-2">{summary.nextSteps.map((step) => <div key={step} className="text-sm text-slate-300">• {step}</div>)}</div>
      </Panel>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Alert rule evaluation</div>
        <div className="mt-5 space-y-3">
          {evaluations.map(({ rule, currentValue, triggered }) => (
            <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{rule.name}</div>
                  <div className="mt-1 text-xs text-slate-400">{rule.metric} {rule.operator} {rule.threshold}</div>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs ${triggered ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{triggered ? 'Triggered' : 'Healthy'}</div>
              </div>
              <div className="mt-2 text-sm text-slate-300">Current value: {currentValue}</div>
            </div>
          ))}
          {!evaluations.length ? <div className="text-sm text-slate-400">Create alert rules to activate incident scoring.</div> : null}
        </div>
      </Panel>
    </div>
  );
}
