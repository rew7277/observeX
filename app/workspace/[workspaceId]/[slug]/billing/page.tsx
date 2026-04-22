import { Panel } from "@/components/panel";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

const plans = [
  { name: "Starter", price: "$29/mo", copy: "Single team workspace, manual uploads, basic dashboards" },
  { name: "Growth", price: "$149/mo", copy: "Multi-user access, sources, better retention, team management" },
  { name: "Enterprise", price: "Custom", copy: "SSO, advanced security, private deployment, premium support" }
];

export default async function BillingPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Billing and plans</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Billing-ready SaaS foundation</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">This page gives you the structure needed for Stripe integration, subscriptions, invoice contact fields, and plan-based entitlements.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-[28px] border p-5 ${workspace.planTier.toLowerCase() === plan.name.toLowerCase() ? "border-cyan-300/30 bg-cyan-400/10" : "border-white/10 bg-white/[0.04]"}`}>
              <div className="text-xl font-semibold">{plan.name}</div>
              <div className="mt-3 text-3xl font-semibold">{plan.price}</div>
              <div className="mt-3 text-sm leading-6 text-slate-400">{plan.copy}</div>
            </div>
          ))}
        </div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Current billing profile</div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Plan", workspace.planTier.toUpperCase()],
              ["Billing email", workspace.billingEmail || "Not set"],
              ["Workspace", workspace.name],
              ["Retention", `${workspace.retentionDays} days`]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="text-xs text-slate-400">{label}</div>
                <div className="mt-2 font-medium">{value}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Implementation notes</div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-400">
            <p>Use this page to wire Stripe checkout, customer portal, invoice history, and entitlement checks.</p>
            <p>The schema already stores plan tier and billing email, so you can plug in usage-based or seat-based billing next.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
