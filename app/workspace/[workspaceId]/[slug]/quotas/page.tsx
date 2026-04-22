import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";
import { getWorkspaceQuotaReport, getRetentionPreview } from "@/lib/retention";

export default async function QuotasPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const quota = await getWorkspaceQuotaReport(workspaceId);
  const retention = await getRetentionPreview(workspaceId);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Quotas & retention</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Workspace usage controls</h1>
      </header>
      <div className="grid gap-5 md:grid-cols-4">
        {[
          ["Ingest used", `${quota.usage.usedMb} MB`],
          ["Ingest limit", `${quota.usage.ingestLimitMb} MB`],
          ["Members", `${quota.usage.members}/${quota.usage.memberLimit}`],
          ["Event count", quota.usage.eventCount.toLocaleString()],
        ].map(([label, value]) => <Panel key={String(label)} className="p-5"><div className="text-xs text-slate-400">{label}</div><div className="mt-2 text-2xl font-semibold">{value}</div></Panel>)}
      </div>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Usage progress</div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${quota.usage.usagePercent}%` }} /></div>
        <div className="mt-2 text-sm text-slate-400">{quota.usage.usagePercent}% of monthly ingest allowance consumed.</div>
      </Panel>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Retention cleanup preview</div>
        <div className="mt-2 text-sm text-slate-400">Records older than {retention.cutoff.toLocaleString()} are candidates for cleanup.</div>
        <div className="mt-5 space-y-3">{retention.expiringUploads.map((upload) => <div key={upload.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><div className="font-medium">{upload.fileName}</div><div className="mt-1 text-xs text-slate-400">{new Date(upload.createdAt).toLocaleString()} • {upload.fileSizeBytes} bytes</div></div>)}{!retention.expiringUploads.length ? <div className="text-sm text-slate-400">No uploads are currently beyond the retention cutoff.</div> : null}</div>
      </Panel>
    </div>
  );
}
