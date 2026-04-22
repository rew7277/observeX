import Link from "next/link";
import { ArrowRight, Shield, UploadCloud, Workflow, BarChart3, BellRing, Lock, Users, WalletCards, DatabaseZap } from "lucide-react";
import { Panel } from "@/components/panel";

const features = [
  { title: "Drag & drop ingestion", copy: "Upload log files directly and transform them into searchable records, operational views, and visual analytics.", icon: UploadCloud },
  { title: "Flow and trace analysis", copy: "Track application flow hops, request traces, and likely bottlenecks from the data you actually upload.", icon: Workflow },
  { title: "Executive-grade dashboards", copy: "Beautiful SaaS visuals for reliability, alerting, latency, application load, and environment health.", icon: BarChart3 },
  { title: "Role-ready team model", copy: "Workspace memberships, invites, and role-based expansion points for multi-user SaaS operations.", icon: Users },
  { title: "Connectors and ingestion sources", copy: "Foundation for S3 ingestion, API-based pull connectors, scheduling metadata, and hybrid log collection.", icon: DatabaseZap },
  { title: "Billing-ready workspace core", copy: "Starter, growth, and enterprise plan structure for Stripe-style billing expansion.", icon: WalletCards },
  { title: "Alert-centric investigation", copy: "Turn warnings and errors into actionable operational summaries for engineering and business teams.", icon: BellRing },
  { title: "Compliance-friendly observability", copy: "Perfect base for PII masking, policy checks, audit views, and security analytics modules.", icon: Shield },
  { title: "Protected session flows", copy: "Cookie-based authentication and workspace-aware protected routes ready for production hardening.", icon: Lock }
];

export default function HomePage() {
  return (
    <main className="min-h-screen px-6 py-8 md:px-10 xl:px-16">
      <header className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 font-bold text-cyan-200 ring-1 ring-white/15">OX</div>
          <div>
            <div className="text-xl font-semibold tracking-tight">ObserveX Prime</div>
            <div className="text-sm text-slate-400">Premium SaaS observability suite</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login" className="btn-secondary">Login</Link>
          <Link href="/create-account" className="btn-primary">Create account</Link>
        </div>
      </header>

      <section className="mx-auto mt-14 grid max-w-7xl items-center gap-8 xl:grid-cols-[1.1fr,0.9fr]">
        <div>
          <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Real-time observability SaaS</div>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight leading-[1.02] md:text-7xl">
            Top-tier log intelligence
            <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">for secure multi-environment teams</span>
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-400 md:text-lg">
            A production deployable SaaS platform with polished marketing pages, auth flow, workspace architecture, drag-and-drop uploads, real log parsing, team and source management, billing-ready foundations, and premium dashboards for platform teams.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create-account" className="btn-primary">Launch your workspace <ArrowRight className="ml-2 h-4 w-4" /></Link>
            <Link href="/login" className="btn-secondary">Sign in</Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              ["Multi-tenant foundation", "Workspace URLs, memberships, invites, and plan-aware settings"],
              ["Real uploads", "Dashboards fed by uploaded log content instead of fake static cards"],
              ["GitHub + Railway ready", "Deploy path, Prisma, PostgreSQL, and environment setup included"]
            ].map(([title, desc]) => (
              <Panel key={title} className="p-5">
                <div className="text-lg font-semibold">{title}</div>
                <div className="mt-2 text-sm leading-6 text-slate-400">{desc}</div>
              </Panel>
            ))}
          </div>
        </div>

        <Panel className="overflow-hidden p-4 md:p-6">
          <div className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold">ObserveX Mission Control</div>
                <div className="mt-1 text-sm text-slate-400">Premium workspace preview</div>
              </div>
              <div className="badge">SaaS-ready UI</div>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {[["48.2M", "Logs Ingested"], ["286 ms", "Avg Trace Latency"], ["14", "Open Alerts"], ["98.7%", "Masked Fields"]].map(([value, label]) => (
                <div key={label} className="rounded-[24px] border border-white/10 bg-white/[0.05] p-5">
                  <div className="text-sm text-slate-400">{label}</div>
                  <div className="mt-2 text-3xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="text-sm text-slate-400">Core capabilities</div>
              <div className="mt-3 grid gap-3 text-sm text-slate-200 md:grid-cols-2">
                <div className="rounded-2xl bg-white/[0.04] p-4">Workspace-aware dashboards</div>
                <div className="rounded-2xl bg-white/[0.04] p-4">Log drag and drop ingestion</div>
                <div className="rounded-2xl bg-white/[0.04] p-4">Team, billing, and source management</div>
                <div className="rounded-2xl bg-white/[0.04] p-4">Railway deployment setup</div>
              </div>
            </div>
          </div>
        </Panel>
      </section>

      <section className="mx-auto mt-16 max-w-7xl">
        <div className="max-w-2xl">
          <div className="text-sm uppercase tracking-[0.22em] text-cyan-300/90">Feature set</div>
          <h2 className="mt-3 text-3xl font-semibold md:text-4xl">Built like a serious SaaS product, not a demo shell</h2>
          <p className="mt-3 text-base leading-7 text-slate-400">This version adds the missing business product layer so you can keep extending into alerting, masking, RCA summaries, invites, roles, sources, and long-term multi-tenant operations.</p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <Panel key={item.title} className="p-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Icon className="h-6 w-6" /></div>
                <div className="mt-4 text-xl font-semibold">{item.title}</div>
                <div className="mt-3 text-sm leading-7 text-slate-400">{item.copy}</div>
              </Panel>
            );
          })}
        </div>
      </section>
    </main>
  );
}
