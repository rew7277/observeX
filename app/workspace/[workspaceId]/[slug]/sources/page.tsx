import { Panel } from "@/components/panel";
import { SourceForm } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function SourcesPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Source connectors</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">API and S3 ingestion sources</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Sources now keep operational metadata so you can extend into workers, health checks, retries, and scheduled syncs.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">Add new source</div>
        <div className="mt-4"><SourceForm workspaceId={workspaceId} /></div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Configured sources</div>
          <div className="mt-5 space-y-3">
            {workspace.apiSources.map((source) => (
              <div key={source.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{source.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{String(source.type).toUpperCase()} • {source.schedule || "No schedule yet"}</div>
                    <div className="mt-2 text-sm text-slate-300">{source.endpointUrl || source.bucketName || "Connector metadata configured"}</div>
                    <div className="mt-2 text-xs text-slate-500">Secret ref: {source.secretRef || "Not set"}</div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs ${source.status === "active" ? "bg-emerald-500/20 text-emerald-300" : source.status === "paused" ? "bg-yellow-500/20 text-yellow-300" : "bg-rose-500/20 text-rose-300"}`}>{source.status}</div>
                </div>
              </div>
            ))}
            {!workspace.apiSources.length ? <div className="text-sm text-slate-400">No sources configured yet.</div> : null}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Recent source activity</div>
          <div className="mt-5 space-y-3">
            {workspace.sourceRuns.map((run) => (
              <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="font-medium">{run.apiSource?.name || "Workspace run"}</div>
                <div className="mt-1 text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()} • {run.status}</div>
                <div className="mt-2 text-sm text-slate-300">Fetched {run.recordsFetched} • Stored {run.recordsStored}</div>
                {run.errorMessage ? <div className="mt-2 text-xs text-amber-200">{run.errorMessage}</div> : null}
              </div>
            ))}
            {!workspace.sourceRuns.length ? <div className="text-sm text-slate-400">No source run history yet.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
