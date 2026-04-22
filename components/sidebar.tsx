"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Shield, LayoutDashboard, Upload, Activity, Bell,
  Workflow, Settings, Users, DatabaseZap, WalletCards,
  ChevronLeft, ChevronRight, Search, Siren, Radar, ScanSearch, Gauge, GitCompareArrows, FileOutput, PieChart,
} from "lucide-react";

const items = [
  { label: "Overview",       icon: LayoutDashboard,   href: "overview"        },
  { label: "Search",         icon: Search,            href: "search"          },
  { label: "Upload Logs",    icon: Upload,            href: "upload"          },
  { label: "Live Logs",      icon: Activity,          href: "live-logs"       },
  { label: "Trace Explorer", icon: ScanSearch,        href: "trace-explorer"  },
  { label: "Flow Analytics", icon: Workflow,          href: "flow-analytics"  },
  { label: "Anomalies",      icon: Radar,             href: "anomalies"       },
  { label: "Incidents",      icon: Siren,             href: "incidents"       },
  { label: "Latency",        icon: Gauge,             href: "latency"         },
  { label: "Compare",        icon: GitCompareArrows,  href: "compare"         },
  { label: "Alerts",         icon: Bell,              href: "alerts"          },
  { label: "Security",       icon: Shield,            href: "security"        },
  { label: "PII Scanner",    icon: Shield,            href: "pii-scanner"     },
  { label: "Sources",        icon: DatabaseZap,       href: "sources"         },
  { label: "Exports",        icon: FileOutput,        href: "exports"         },
  { label: "Quotas",         icon: PieChart,          href: "quotas"          },
  { label: "Team",           icon: Users,             href: "team"            },
  { label: "Billing",        icon: WalletCards,       href: "billing"         },
  { label: "Settings",       icon: Settings,          href: "settings"        },
];

export function Sidebar({ workspaceId, slug }: { workspaceId: string; slug: string }) {
  const pathname  = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted,   setMounted]   = useState(false);

  // Read persisted state only after hydration to avoid mismatch
  useEffect(() => {
    setMounted(true);
    setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem("sidebar-collapsed", String(next));
  };

  return (
    <aside
      className={`hidden xl:flex flex-col border-r border-white/10 bg-white/[0.04] transition-all duration-300 ease-in-out ${
        mounted && collapsed ? "w-[72px]" : "w-72"
      }`}
      style={{ flexShrink: 0 }}
    >
      {/* ── Logo + Toggle ─────────────────────────────────── */}
      <div className={`flex items-center p-5 ${collapsed && mounted ? "justify-center" : "justify-between"}`}>
        {(!mounted || !collapsed) && (
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 font-bold text-cyan-200 ring-1 ring-white/15">
              OX
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">ObserveX Prime</div>
              <div className="truncate text-xs text-slate-400">Autonomous observability</div>
            </div>
          </div>
        )}
        {mounted && collapsed && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400/25 to-violet-500/25 font-bold text-cyan-200 ring-1 ring-white/15">
            OX
          </div>
        )}
        <button
          onClick={toggle}
          className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-400 transition hover:bg-white/10 hover:text-white"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {mounted && collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Mission Control blurb (expanded only) ────────── */}
      {(!mounted || !collapsed) && (
        <div className="mx-4 rounded-[22px] border border-white/10 bg-gradient-to-br from-cyan-500/10 via-sky-500/5 to-violet-500/10 p-4">
          <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-300/90">Mission Control</div>
          <div className="mt-2 text-sm font-semibold leading-snug">
            One SaaS workspace for logs, team access, sources, billing, and security.
          </div>
        </div>
      )}

      {/* ── Nav items ────────────────────────────────────── */}
      <nav className={`mt-5 flex-1 space-y-1 overflow-y-auto ${mounted && collapsed ? "px-2" : "px-4"}`}>
        {items.map((item) => {
          const Icon    = item.icon;
          const href    = `/workspace/${workspaceId}/${slug}/${item.href}`;
          const isActive = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              title={mounted && collapsed ? item.label : undefined}
              className={`group flex items-center rounded-2xl transition ${
                mounted && collapsed
                  ? "justify-center px-0 py-3"
                  : "justify-between px-4 py-3"
              } ${
                isActive
                  ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-300/30"
                  : "text-slate-300 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <span className={`flex items-center ${mounted && collapsed ? "" : "gap-3"}`}>
                <Icon className="h-4 w-4 shrink-0" />
                {(!mounted || !collapsed) && <span>{item.label}</span>}
              </span>
              {(!mounted || !collapsed) && (
                <span className="text-[10px] text-slate-500 group-hover:text-slate-300">›</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Collapse hint at bottom ───────────────────────── */}
      {(!mounted || !collapsed) && (
        <div className="p-4 text-center">
          <button
            onClick={toggle}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-400 transition hover:bg-white/8 hover:text-white"
          >
            <ChevronLeft className="h-3 w-3" /> Collapse
          </button>
        </div>
      )}
    </aside>
  );
}
