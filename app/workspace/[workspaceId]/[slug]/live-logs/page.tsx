import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function LiveLogsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { records } = await getWorkspaceContext(workspaceId, slug, user.id);
  const latest = [...records].sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0, 40);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Stream viewer</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Live-style log explorer</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">This page uses the uploaded dataset as a live-style stream table so you can drill into severity, environment, application, and trace identifiers.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="overflow-hidden rounded-[24px] border border-white/10">
          <div className="grid grid-cols-6 gap-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <div>Time</div><div>Level</div><div>Application</div><div>Environment</div><div>Trace</div><div>Message</div>
          </div>
          {latest.map((row, index) => (
            <div key={`${row.traceId}-${index}`} className="grid grid-cols-6 gap-2 border-b border-white/5 px-4 py-4 text-sm">
              <div>{String(row.timestamp)}</div>
              <div>{row.level}</div>
              <div>{row.application}</div>
              <div>{row.environment}</div>
              <div className="text-cyan-300">{row.traceId}</div>
              <div className="truncate">{row.message}</div>
            </div>
          ))}
          {!latest.length ? <div className="px-4 py-10 text-center text-sm text-slate-400">Upload logs to explore records here.</div> : null}
        </div>
      </Panel>
    </div>
  );
}
