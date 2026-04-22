import { UploadDropzone } from "@/components/upload-dropzone";
import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function UploadPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Log ingestion</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Upload and visualize real log files</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Drag and drop a log file, tag it with the right source label and environment, and ObserveX will parse it into charts, searchable views, and operational summaries.</p>
      </header>

      <UploadDropzone workspaceId={workspaceId} />

      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">Recent uploads</div>
        <div className="mt-1 text-sm text-slate-400">Latest ingestion history for this workspace</div>
        <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
          <div className="grid grid-cols-6 gap-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <div>File</div><div>Format</div><div>Source</div><div>Environment</div><div>Created</div><div>Records</div>
          </div>
          {workspace.uploads.map((upload) => (
            <div key={upload.id} className="grid grid-cols-6 gap-2 border-b border-white/5 px-4 py-4 text-sm">
              <div className="font-medium">{upload.fileName}</div>
              <div className="uppercase">{String(upload.sourceType)}</div>
              <div>{upload.sourceLabel || "Manual upload"}</div>
              <div>{upload.environment || "Unknown"}</div>
              <div>{new Date(upload.createdAt).toLocaleString()}</div>
              <div>{Array.isArray(upload.parsedJson) ? upload.parsedJson.length : 0}</div>
            </div>
          ))}
          {!workspace.uploads.length ? <div className="px-4 py-10 text-center text-sm text-slate-400">No uploads yet.</div> : null}
        </div>
      </Panel>
    </div>
  );
}
