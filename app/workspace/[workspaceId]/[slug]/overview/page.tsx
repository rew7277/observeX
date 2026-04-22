import Link from "next/link";
import { Panel } from "@/components/panel";
import { db } from "@/lib/db";
import { buildMetrics } from "@/lib/log-parser";
import { TimelineChart, DistributionPie, ApplicationBar } from "@/components/charts";
import { UploadCloud, AlertTriangle, Shield, Activity } from "lucide-react";

export default async function OverviewPage({
  params
}: {
  params: Promise<{ workspaceId: string; slug: string }>;
}) {
  const { workspaceId, slug } = await params;
  const uploads = await db.upload.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  const records = uploads.flatMap((upload) => (upload.parsedJson as any[]) || []);
  const metrics = buildMetrics(records);

  const latest = uploads[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <div className="badge">
            <span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" />
            Real-time workspace overview
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight leading-none md:text-5xl">
            Advanced log intelligence
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
              powered by your uploaded data
            </span>
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400 md:text-base">
            This dashboard is generated from actual uploaded records in your workspace. Upload more files to expand trends, application coverage, environment visibility, and alert context.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href={`/workspace/${workspaceId}/${slug}/upload`} className="btn-primary">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload logs
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Logs Ingested", value: metrics.totalLogs, meta: `${uploads.length} file(s) uploaded`, icon: Activity },
          { label: "Avg Trace Latency", value: `${metrics.avgLatency} ms`, meta: "Calculated from log data", icon: Activity },
          { label: "Alert Signals", value: metrics.alertCount, meta: "ERROR + WARN derived", icon: AlertTriangle },
          { label: "Workspace Health", value: metrics.health, meta: "Auto-derived status", icon: Shield }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Panel key={card.label} className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-slate-400">{card.label}</div>
                  <div className="mt-3 text-3xl font-semibold">{card.value}</div>
                  <div className="mt-2 text-xs text-cyan-300">{card.meta}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.05] p-3 text-cyan-300">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Panel>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Latency and error timeline</div>
              <div className="mt-1 text-sm text-slate-400">Built from uploaded records grouped by hour</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-400">
              {metrics.timeline.length || 0} time bucket(s)
            </div>
          </div>
          <div className="mt-5">
            <TimelineChart data={metrics.timeline} />
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Latest upload</div>
          <div className="mt-1 text-sm text-slate-400">Most recent ingestion event</div>
          {latest ? (
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">File name</div>
                <div className="mt-2 font-medium">{latest.fileName}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">Detected format</div>
                <div className="mt-2 font-medium uppercase">{latest.sourceType}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">Uploaded at</div>
                <div className="mt-2 font-medium">{new Date(latest.createdAt).toLocaleString()}</div>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-cyan-300/30 bg-cyan-400/5 p-5 text-sm leading-7 text-slate-300">
              No logs uploaded yet. Start by uploading a file and the workspace will automatically generate charts and summaries from the real data.
            </div>
          )}
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Environment distribution</div>
          <div className="mt-1 text-sm text-slate-400">How many records came from each environment</div>
          <DistributionPie data={metrics.environments} />
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {metrics.environments.map((item) => (
              <span key={item.name} className="rounded-full bg-white/[0.05] px-3 py-1 text-slate-300">
                {item.name}: {item.value}
              </span>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Top applications</div>
          <div className="mt-1 text-sm text-slate-400">Most active applications in your recent uploads</div>
          <ApplicationBar data={metrics.applications} />
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-5 2xl:grid-cols-5">
        <Panel className="p-5 md:p-6 2xl:col-span-3">
          <div className="text-lg font-semibold">Recent records</div>
          <div className="mt-1 text-sm text-slate-400">Sample taken from parsed uploads</div>

          <div className="mt-5 overflow-hidden rounded-[24px] border border-white/10">
            <div className="grid grid-cols-7 gap-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <div>Time</div>
              <div>App</div>
              <div>Env</div>
              <div>Level</div>
              <div>Trace</div>
              <div className="col-span-2">Message</div>
            </div>
            {records.slice(0, 8).map((row, index) => (
              <div key={index} className="grid grid-cols-7 gap-2 border-b border-white/5 px-4 py-4 text-sm hover:bg-white/[0.04]">
                <div className="text-slate-300">{String(row.timestamp)}</div>
                <div className="font-medium">{String(row.application)}</div>
                <div>{String(row.environment)}</div>
                <div>{String(row.level)}</div>
                <div className="text-cyan-300">{String(row.traceId)}</div>
                <div className="col-span-2">{String(row.message)}</div>
              </div>
            ))}
            {!records.length ? (
              <div className="px-4 py-10 text-center text-sm text-slate-400">
                Upload logs to populate this table.
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6 2xl:col-span-2">
          <div className="text-lg font-semibold">What to build next</div>
          <div className="mt-1 text-sm text-slate-400">Good next upgrades for a real SaaS product</div>
          <div className="mt-5 space-y-3">
            {[
              "Add organization invitations and team roles",
              "Store uploaded files in S3 instead of database text for large volume ingestion",
              "Add alert rules, saved searches, and RCA summaries",
              "Add API source connectors for live ingestion",
              "Add RBAC-based field masking and audit logs",
              "Add billing, plans, and usage metering"
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm leading-6 text-slate-300">
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
