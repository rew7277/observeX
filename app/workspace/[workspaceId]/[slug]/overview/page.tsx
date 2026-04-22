import Link from "next/link";
import { Panel } from "@/components/panel";
import { TimelineChart, DistributionPie, ApplicationBar, LevelBreakdownBar } from "@/components/charts";
import {
  UploadCloud, AlertTriangle, Shield, Activity,
  DatabaseZap, TrendingUp, Clock, Zap
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string; slug: string }>;
}) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics } = await getWorkspaceContext(workspaceId, slug, user.id);
  const latest = workspace.uploads[0];

  const healthColor =
    metrics.health === "Healthy"  ? "text-emerald-300" :
    metrics.health === "Watch"    ? "text-amber-300"   : "text-rose-400";

  const kpis = [
    {
      label: "Logs ingested",
      value: metrics.totalLogs.toLocaleString(),
      meta: `${workspace.uploads.length} upload(s)`,
      icon: Activity,
      accent: "cyan",
    },
    {
      label: "Avg latency",
      value: `${metrics.avgLatency} ms`,
      meta: metrics.avgLatency > 500 ? "⚠ High latency detected" : "Within normal range",
      icon: Clock,
      accent: metrics.avgLatency > 500 ? "amber" : "cyan",
    },
    {
      label: "Errors",
      value: metrics.errorCount.toLocaleString(),
      meta: `${metrics.errorRate}% error rate`,
      icon: AlertTriangle,
      accent: metrics.errorCount > 0 ? "rose" : "emerald",
    },
    {
      label: "Warnings",
      value: metrics.warnCount.toLocaleString(),
      meta: `${metrics.alertCount} total signals`,
      icon: Zap,
      accent: metrics.warnCount > 0 ? "amber" : "emerald",
    },
    {
      label: "Workspace health",
      value: metrics.health,
      meta: "Auto-derived from log data",
      icon: Shield,
      accent: metrics.health === "Healthy" ? "emerald" : metrics.health === "Watch" ? "amber" : "rose",
    },
    {
      label: "Data sources",
      value: workspace.apiSources.length,
      meta: latest ? `Latest: ${latest.fileName}` : "No uploads yet",
      icon: DatabaseZap,
      accent: "violet",
    },
  ] as const;

  const accentMap = {
    cyan:    { bg: "bg-cyan-400/10",    text: "text-cyan-300"    },
    amber:   { bg: "bg-amber-400/10",   text: "text-amber-300"   },
    rose:    { bg: "bg-rose-400/10",    text: "text-rose-400"    },
    emerald: { bg: "bg-emerald-400/10", text: "text-emerald-300" },
    violet:  { bg: "bg-violet-400/10",  text: "text-violet-300"  },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
            All metrics below are computed live from your uploaded log records — every chart,
            count, and status reflects actual ingested data. Upload a new file to refresh instantly.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/workspace/${workspaceId}/${slug}/upload`} className="btn-primary">
            <UploadCloud className="mr-2 h-4 w-4" /> Upload logs
          </Link>
          <Link href={`/workspace/${workspaceId}/${slug}/sources`} className="btn-secondary">
            <DatabaseZap className="mr-2 h-4 w-4" /> Configure sources
          </Link>
        </div>
      </header>

      {/* KPI Cards */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((card) => {
          const Icon = card.icon;
          const { bg, text } = accentMap[card.accent];
          return (
            <Panel key={card.label} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">{card.label}</div>
                  <div className={`mt-2 text-3xl font-semibold ${card.label === "Workspace health" ? healthColor : ""}`}>
                    {card.value}
                  </div>
                  <div className={`mt-2 text-xs ${text}`}>{card.meta}</div>
                </div>
                <div className={`rounded-2xl ${bg} p-3 ${text}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Panel>
          );
        })}
      </section>

      {/* Timeline + Level Breakdown */}
      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Observability pulse</div>
              <div className="mt-1 text-sm text-slate-400">
                Errors, warnings, and avg latency over time — from ingested records
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-400 whitespace-nowrap">
              {workspace.uploads.length} dataset(s)
            </div>
          </div>
          <div className="mt-5">
            <TimelineChart data={metrics.timeline} />
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Log level breakdown</div>
          <div className="mt-1 text-sm text-slate-400">Distribution across all ingested records</div>
          <div className="mt-5">
            <LevelBreakdownBar data={metrics.levels} total={metrics.totalLogs} />
          </div>
          {metrics.totalLogs > 0 && (
            <div className="mt-5 grid gap-2">
              {metrics.levels.map((l) => {
                const pct = ((l.value / metrics.totalLogs) * 100).toFixed(1);
                const color =
                  l.name === "ERROR" ? "text-rose-400" :
                  l.name === "WARN"  ? "text-amber-300" :
                  l.name === "INFO"  ? "text-cyan-300"  : "text-slate-400";
                return (
                  <div key={l.name} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm">
                    <span className={`font-mono font-semibold ${color}`}>{l.name}</span>
                    <span className="text-slate-300">
                      {l.value.toLocaleString()}{" "}
                      <span className="text-slate-500">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {metrics.totalLogs === 0 && (
            <div className="mt-10 text-center text-sm text-slate-500">
              Upload a log file to see level breakdown
            </div>
          )}
        </Panel>
      </section>

      {/* Environment + Application Volume */}
      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Environment distribution</div>
          <div className="mt-1 text-sm text-slate-400">Log records per environment</div>
          <div className="mt-5">
            <DistributionPie data={metrics.environments} />
          </div>
        </Panel>
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="text-lg font-semibold">Application volume</div>
          <div className="mt-1 text-sm text-slate-400">Top applications by log record count</div>
          <div className="mt-5">
            <ApplicationBar data={metrics.applications} />
          </div>
        </Panel>
      </section>

      {/* Slowest Apps + Busiest Traces */}
      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-amber-300" />
            <div className="text-lg font-semibold">Slowest applications</div>
          </div>
          <div className="text-sm text-slate-400 mb-5">Ranked by average latency across all uploads</div>
          <div className="space-y-2">
            {metrics.slowestApplications.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">No latency data yet</div>
            )}
            {metrics.slowestApplications.map((app, i) => (
              <div key={app.name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="w-5 shrink-0 text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="flex-1 truncate font-medium">{app.name}</span>
                <span className={`font-mono font-semibold shrink-0 ${
                  app.avgLatency > 500 ? "text-rose-400" :
                  app.avgLatency > 200 ? "text-amber-300" : "text-emerald-300"
                }`}>
                  {app.avgLatency} ms
                </span>
                <span className="text-xs text-slate-500 shrink-0">{app.count.toLocaleString()} logs</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-4 w-4 text-violet-300" />
            <div className="text-lg font-semibold">Busiest traces</div>
          </div>
          <div className="text-sm text-slate-400 mb-5">Trace IDs with the most log entries</div>
          <div className="space-y-2">
            {metrics.busiestTraces.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">No trace data yet</div>
            )}
            {metrics.busiestTraces.map((t, i) => (
              <div key={t.traceId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="w-5 shrink-0 text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="flex-1 truncate font-mono text-xs text-violet-300">{t.traceId}</span>
                <span className="font-semibold text-slate-200 shrink-0">{t.count.toLocaleString()}</span>
                <span className="text-xs text-slate-500 shrink-0">entries</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      {/* Recent Uploads */}
      {workspace.uploads.length > 0 && (
        <Panel className="p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">Recent uploads</div>
              <div className="mt-1 text-sm text-slate-400">Latest ingestion activity in this workspace</div>
            </div>
            <Link href={`/workspace/${workspaceId}/${slug}/upload`} className="btn-secondary text-xs">
              View all
            </Link>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-5 gap-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
              <div>File</div>
              <div>Environment</div>
              <div>Source</div>
              <div>Records</div>
              <div>Uploaded</div>
            </div>
            {workspace.uploads.slice(0, 5).map((upload) => {
              const count = Array.isArray(upload.parsedJson) ? upload.parsedJson.length : 0;
              return (
                <div key={upload.id} className="grid grid-cols-5 gap-2 border-b border-white/5 px-4 py-4 text-sm last:border-0">
                  <div className="truncate font-medium text-slate-200">{upload.fileName}</div>
                  <div className="truncate text-slate-400">{upload.environment || "Unknown"}</div>
                  <div className="truncate text-slate-400">{upload.sourceLabel || "Manual upload"}</div>
                  <div className="font-mono text-cyan-300">{count.toLocaleString()}</div>
                  <div className="text-slate-500 text-xs">{new Date(upload.createdAt).toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
