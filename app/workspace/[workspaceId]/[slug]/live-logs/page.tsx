import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";
import { LiveLogsClient } from "@/components/live-logs-client";

export default async function LiveLogsPage({
  params,
}: {
  params: Promise<{ workspaceId: string; slug: string }>;
}) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { records } = await getWorkspaceContext(workspaceId, slug, user.id);

  // Sort newest first, pass up to 5000 records to the client
  const sorted = [...records]
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 5000);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge">
          <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Stream viewer
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
          Live-style log explorer
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
          Search by keyword, filter by level or date range, and click any row for a full detail
          popup. All data is sourced from your uploaded log files.
        </p>
      </header>

      <LiveLogsClient records={sorted} />
    </div>
  );
}
