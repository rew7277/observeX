import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";
import { LiveLogsClient } from "@/components/live-logs-client";

export default async function LiveLogsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }> }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  await getWorkspaceBasic(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Real-time stream</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Live log stream</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">
          Events stream in real-time via SSE. New events appear automatically. Filter by level, date range, or keyword.
        </p>
      </header>
      <LiveLogsClient workspaceId={workspaceId} />
    </div>
  );
}
