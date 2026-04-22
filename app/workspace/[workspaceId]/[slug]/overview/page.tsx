import Link from "next/link";
import { Panel } from "@/components/panel";
import { TimelineChart, DistributionPie, ApplicationBar } from "@/components/charts";
import { UploadCloud, AlertTriangle, Shield, Activity, Users, DatabaseZap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function OverviewPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace, metrics } = await getWorkspaceContext(workspaceId, slug, user.id);
  const latest = workspace.uploads[0];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 2xl:flex-row 2xl:items-end 2xl:justify-between">
        <div>
          <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Real-time workspace overview</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight leading-none md:text-5xl">Advanced log intelligence<span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">powered by your uploaded data</span></h1>
          <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400 md:text-base">This dashboard is generated from actual uploaded records in your workspace and now includes the SaaS management layer for team access, sources, billing posture, and long-term operations.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={`/workspace/${workspaceId}/${slug}/upload`} className="btn-primary"><UploadCloud className="mr-2 h-4 w-4" /> Upload logs</Link>
          <Link href={`/workspace/${workspaceId}/${slug}/sources`} className="btn-secondary"><DatabaseZap className="mr-2 h-4 w-4" /> Configure sources</Link>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Logs ingested", value: metrics.totalLogs, meta: `${workspace.uploads.length} upload(s)`, icon: Activity },
          { label: "Avg latency", value: `${metrics.avgLatency} ms`, meta: "Calculated from log data", icon: Activity },
          { label: "Alert signals", value: metrics.alertCount, meta: `${metrics.errorRate}% error rate`, icon: AlertTriangle },
          { label: "Workspace health", value: metrics.health, meta: "Auto-derived status", icon: Shield },
          { label: "Team members", value: workspace.memberships.length, meta: `${workspace.invites.filter((i) => i.status === "pending").length} pending invite(s)`, icon: Users },
          { label: "Data sources", value: workspace.apiSources.length, meta: latest ? `Latest upload: ${latest.fileName}` : "No uploads yet", icon: DatabaseZap }
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Panel key={card.label} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">{card.label}</div>
                  <div className="mt-2 text-3xl font-semibold">{card.value}</div>
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-lg font-semibold">Observability pulse</div>
              <div className="mt-1 text-sm text-slate-400">Errors, warnings, and average latency over time</div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-slate-400">Latest uploaded dataset</div>
          </div>
          <div className="mt-5"><TimelineChart data={metrics.timeline} /></div>
        </Panel>

        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Workspace control plane</div>
          <div className="mt-1 text-sm text-slate-400">Management modules now included in the app shell</div>
          <div className="mt-5 grid gap-3 text-sm">
            {[
              ["Plan tier", workspace.planTier.toUpperCase()],
              ["Retention", `${workspace.retentionDays} days`],
              ["Ingestion", workspace.ingestionMode],
              ["Storage", workspace.logStorageMode],
              ["Billing email", workspace.billingEmail || "Not set"],
              ["Custom domain", workspace.domain || "Not configured"]
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 font-medium text-slate-100">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Environment distribution</div>
          <div className="mt-5"><DistributionPie data={metrics.environments} /></div>
        </Panel>
        <Panel className="p-5 md:p-6 xl:col-span-2">
          <div className="text-lg font-semibold">Application volume</div>
          <div className="mt-5"><ApplicationBar data={metrics.applications} /></div>
        </Panel>
      </section>
    </div>
  );
}
