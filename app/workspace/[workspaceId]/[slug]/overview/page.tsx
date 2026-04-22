import Link from "next/link";
import { Panel } from "@/components/panel";
import { TimelineChart, DistributionPie, ApplicationBar, LevelBreakdownBar } from "@/components/charts";
import { UploadCloud, AlertTriangle, Shield, Activity, DatabaseZap, TrendingUp, Clock, Zap, SearchCheck, Fingerprint } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function OverviewPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics, securityStats } = await getWorkspaceContext(workspaceId, slug, user.id);
  const latest = workspace.uploads[0];

  const healthColor = metrics.health === "Healthy" ? "text-emerald-300" : metrics.health === "Watch" ? "text-amber-300" : "text-rose-400";

  const kpis = [
    { label: "Indexed events", value: metrics.totalLogs.toLocaleString(), meta: `${workspace.uploads.length} uploads`, icon: Activity },
    { label: "Avg latency", value: `${metrics.avgLatency} ms`, meta: `P95 ${metrics.p95Latency} ms`, icon: Clock },
    { label: "Error rate", value: `${metrics.errorRate}%`, meta: `${metrics.errorCount} errors`, icon: AlertTriangle },
    { label: "Security flags", value: securityStats.piiEvents.toLocaleString(), meta: "PII/secret detections", icon: Shield },
    { label: "Searchable apps", value: metrics.applications.length.toString(), meta: latest ? `Latest ${latest.fileName}` : "No uploads yet", icon: SearchCheck },
    { label: "Workspace health", value: metrics.health, meta: `${metrics.anomalySignals.length} anomaly signals`, icon: Fingerprint }
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Advanced workspace overview</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight leading-none md:text-5xl">
            Secure indexed observability
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">backed by log events, not just file blobs</span>
          </h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400 md:text-base">
            This upgraded build persists log events for faster analytics, stronger security review, richer alerting, and future connector-based ingestion.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/workspace/${workspaceId}/${slug}/upload`} className="btn-primary"><UploadCloud className="mr-2 h-4 w-4" /> Upload logs</Link>
          <Link href={`/workspace/${workspaceId}/${slug}/sources`} className="btn-secondary"><DatabaseZap className="mr-2 h-4 w-4" /> Configure sources</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <Panel key={card.label} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">{card.label}</div>
                  <div className={`mt-2 text-3xl font-semibold ${card.label === "Workspace health" ? healthColor : ""}`}>{card.value}</div>
                  <div className="mt-2 text-xs text-cyan-300">{card.meta}</div>
                </div>
                <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><Icon className="h-5 w-5" /></div>
              </div>
            </Panel>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="text-lg font-semibold">Observability pulse</div>
          <div className="mt-1 text-sm text-slate-400">Errors, warnings, and avg latency over time</div>
          <div className="mt-5"><TimelineChart data={metrics.timeline} /></div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Level breakdown</div>
          <div className="mt-1 text-sm text-slate-400">Distribution across indexed events</div>
          <div className="mt-5"><LevelBreakdownBar data={metrics.levels} total={metrics.totalLogs} /></div>
          <div className="mt-5 space-y-2">
            {metrics.anomalySignals.map((signal) => (
              <div key={signal.label} className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm">
                <div className="font-medium text-amber-200">{signal.label}</div>
                <div className="text-xs text-amber-200/70">{signal.value}</div>
              </div>
            ))}
            {!metrics.anomalySignals.length ? <div className="text-sm text-slate-500">No anomaly signals right now.</div> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Environment distribution</div>
          <div className="mt-1 text-sm text-slate-400">Log records per environment</div>
          <div className="mt-5"><DistributionPie data={metrics.environments} /></div>
        </Panel>
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="text-lg font-semibold">Application volume</div>
          <div className="mt-1 text-sm text-slate-400">Top applications by indexed event count</div>
          <div className="mt-5"><ApplicationBar data={metrics.applications} /></div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-amber-300" /><div className="text-lg font-semibold">Slowest applications</div></div>
          <div className="text-sm text-slate-400 mb-5">Ranked by average latency</div>
          <div className="space-y-2">
            {metrics.slowestApplications.map((app, i) => (
              <div key={app.name} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="w-5 shrink-0 text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="flex-1 truncate font-medium">{app.name}</span>
                <span className="font-mono font-semibold text-amber-300 shrink-0">{app.avgLatency} ms</span>
                <span className="text-xs text-slate-500 shrink-0">{app.count.toLocaleString()} logs</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="flex items-center gap-2 mb-1"><Activity className="h-4 w-4 text-violet-300" /><div className="text-lg font-semibold">Busiest traces</div></div>
          <div className="text-sm text-slate-400 mb-5">Only real trace/request/correlation IDs from the uploaded logs</div>
          <div className="space-y-2">
            {metrics.busiestTraces.map((t, i) => (
              <div key={t.traceId} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
                <span className="w-5 shrink-0 text-xs text-slate-500 font-mono">#{i + 1}</span>
                <span className="flex-1 truncate font-mono text-xs text-violet-300">{t.traceId}</span>
                <span className="font-semibold text-slate-200 shrink-0">{t.count.toLocaleString()}</span>
                <span className="text-xs text-slate-500 shrink-0">entries</span>
              </div>
            ))}
            {!metrics.busiestTraces.length ? <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">No real trace IDs were detected in the current log data. Use Flow Analytics for application transitions and grouped errors instead.</div> : null}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Security & platform posture</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Retention", `${workspace.retentionDays} days`],
              ["Ingest quota", `${workspace.maxMonthlyIngestMb} MB/mo`],
              ["User limit", `${workspace.maxUsers}`],
              ["Storage mode", workspace.logStorageMode]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Recent uploads</div>
          <div className="mt-5 space-y-3">
            {workspace.uploads.map((upload) => (
              <div key={upload.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{upload.fileName}</div>
                    <div className="mt-1 text-xs text-slate-400">{upload.recordCount.toLocaleString()} records • {upload.maskedCount.toLocaleString()} sensitive</div>
                  </div>
                  <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 capitalize">{upload.status}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
