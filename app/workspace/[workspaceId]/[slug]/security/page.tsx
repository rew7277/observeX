import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function SecurityPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Security controls</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Compliance and data protection posture</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">The app now includes a security surface for storage posture, audit history, and masked-log friendly workflows.</p>
      </header>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Protection summary</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Storage mode", workspace.logStorageMode],
              ["Retention", `${workspace.retentionDays} days`],
              ["Health status", metrics.health],
              ["Audit events", workspace.auditEvents.length]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Recent audit trail</div>
          <div className="mt-5 space-y-3">
            {workspace.auditEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="font-medium">{event.action}</div>
                <div className="mt-1 text-xs text-slate-400">{event.user.name} • {new Date(event.createdAt).toLocaleString()}</div>
                {event.details ? <div className="mt-2 text-sm text-slate-300">{event.details}</div> : null}
              </div>
            ))}
            {!workspace.auditEvents.length ? <div className="text-sm text-slate-400">No audit entries yet.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
