import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";
import { searchLogEvents } from "@/lib/search";

export default async function SearchPage({ params, searchParams }: { params: Promise<{ workspaceId: string; slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);
  const sp = await searchParams;
  const query = typeof sp.q === "string" ? sp.q : "";
  const level = typeof sp.level === "string" ? sp.level : "";
  const environment = typeof sp.environment === "string" ? sp.environment : "";
  const result = await searchLogEvents({ workspaceId, query, level, environment, limit: 100 });

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Search & saved views</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Server-side log search</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Search now runs against indexed log_events data instead of parsed JSON blobs, so queries are faster, filterable, and API-ready.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <form className="grid gap-4 md:grid-cols-4">
          <input name="q" defaultValue={query} className="input md:col-span-2" placeholder="Search message, signature, trace, application" />
          <input name="level" defaultValue={level} className="input" placeholder="Level (ERROR / WARN / INFO)" />
          <input name="environment" defaultValue={environment} className="input" placeholder="Environment" />
          <button className="btn-primary w-fit">Search</button>
        </form>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-[1.1fr,0.9fr]">
        <Panel className="p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Results</div>
              <div className="mt-1 text-xs text-slate-400">{result.total.toLocaleString()} matching event(s)</div>
            </div>
            <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">API: /api/workspaces/{workspaceId}/search</div>
          </div>
          <div className="mt-5 space-y-3">
            {result.events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>{new Date(event.timestamp).toLocaleString()}</span>
                  <span>•</span>
                  <span>{event.application}</span>
                  <span>•</span>
                  <span>{event.environment}</span>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{event.level}</span>
                </div>
                <div className="mt-2 font-medium break-words">{event.message}</div>
                <div className="mt-2 text-xs text-slate-500 font-mono break-all">trace: {event.traceId}</div>
              </div>
            ))}
            {!result.events.length ? <div className="text-sm text-slate-400">No events matched your filters yet.</div> : null}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Top facets</div>
          <div className="mt-5 space-y-5">
            {[['Applications', result.facets.applications], ['Environments', result.facets.environments], ['Levels', result.facets.levels]].map(([label, items]: any) => (
              <div key={label}>
                <div className="text-sm font-medium">{label}</div>
                <div className="mt-3 space-y-2">
                  {items.map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
                      <span>{item.name}</span>
                      <span className="text-slate-400">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
