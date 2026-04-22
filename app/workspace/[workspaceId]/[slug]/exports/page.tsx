import Link from "next/link";
import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";

export default async function ExportsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Export hub</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">CSV / JSON export</h1>
      </header>
      <Panel className="p-6">
        <div className="text-lg font-semibold">Export endpoints</div>
        <div className="mt-5 space-y-3 text-sm text-slate-300">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">JSON export route: <span className="font-mono text-cyan-300">/api/workspaces/{workspaceId}/search?limit=5000</span></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Webhook ingestion route: <span className="font-mono text-cyan-300">/api/ingest/webhook</span></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">Source test route: <span className="font-mono text-cyan-300">/api/workspaces/{workspaceId}/sources/test</span></div>
        </div>
        <div className="mt-5 text-xs text-slate-500">This release adds server-side export plumbing so you can wire CSV downloads, S3 archival, or downstream incident pipelines cleanly.</div>
      </Panel>
      <Link className="btn-primary inline-flex" href={`/workspace/${workspaceId}/${slug}/search`}>Open search center</Link>
    </div>
  );
}
