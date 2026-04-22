"use client";

import Link from "next/link";
import { Shield, LayoutDashboard, Upload, Activity, Bell, Workflow, Settings, Users, DatabaseZap, WalletCards } from "lucide-react";
import { usePathname } from "next/navigation";

const items = [
  { label: "Overview", icon: LayoutDashboard, href: "overview" },
  { label: "Upload Logs", icon: Upload, href: "upload" },
  { label: "Live Logs", icon: Activity, href: "live-logs" },
  { label: "Flow Analytics", icon: Workflow, href: "flow-analytics" },
  { label: "Alerts", icon: Bell, href: "alerts" },
  { label: "Security", icon: Shield, href: "security" },
  { label: "Team", icon: Users, href: "team" },
  { label: "Sources", icon: DatabaseZap, href: "sources" },
  { label: "Billing", icon: WalletCards, href: "billing" },
  { label: "Settings", icon: Settings, href: "settings" }
];

export function Sidebar({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden xl:flex w-80 flex-col border-r border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 font-bold text-cyan-200 ring-1 ring-white/15">
          OX
        </div>
        <div>
          <div className="text-xl font-semibold tracking-tight">ObserveX Prime</div>
          <div className="text-sm text-slate-400">Autonomous observability cockpit</div>
        </div>
      </div>

      <div className="mt-8 rounded-[28px] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-violet-500/10 p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-cyan-300/90">Mission Control</div>
        <div className="mt-3 text-2xl font-semibold leading-tight">One SaaS workspace for logs, team access, sources, billing, and security.</div>
        <div className="mt-3 text-sm leading-6 text-slate-400">
          Built for platform teams managing multiple apps and environments with premium dashboards, drag & drop ingestion, and production-ready workspace operations.
        </div>
      </div>

      <nav className="mt-8 space-y-2 text-sm">
        {items.map((item) => {
          const Icon = item.icon;
          const href = `/workspace/${workspaceId}/${slug}/${item.href}`;
          const isActive = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`group flex items-center justify-between rounded-2xl px-4 py-3 transition ${
                isActive ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30" : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4" />
                {item.label}
              </span>
              <span className="text-[10px] text-slate-500 group-hover:text-slate-300">›</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
