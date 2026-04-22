import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";
import { db } from "@/lib/db";

export default async function PiiScannerPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const events = await db.logEvent.findMany({ where: { workspaceId, containsPii: true }, orderBy: { timestamp: 'desc' }, take: 100 });

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> PII/secret scanner</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Sensitive data exposure scanner</h1>
      </header>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Flagged events</div>
        <div className="mt-5 space-y-3">{events.map((event) => <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-400"><span>{new Date(event.timestamp).toLocaleString()}</span><span>•</span><span>{event.application}</span><span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] text-rose-300">{event.piiTypes.join(', ') || 'flagged'}</span></div><div className="mt-2 text-sm text-slate-300 break-words">{event.message}</div></div>)}{!events.length ? <div className="text-sm text-slate-400">No PII or secret patterns were detected in indexed events.</div> : null}</div>
      </Panel>
    </div>
  );
}
