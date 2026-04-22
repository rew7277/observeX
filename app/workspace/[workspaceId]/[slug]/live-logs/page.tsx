import { Panel } from "@/components/panel";

export default async function LiveLogsPage() {
  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> SaaS module</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Live log stream</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Use this page to extend into tailing, search, filtering, and trace drill-down.</p>
      </header>

      <Panel className="p-6">
        <div className="text-lg font-semibold">Module scaffold ready</div>
        <div className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
          This section is intentionally prepared as a clean extension point so you can continue building the application without changing the overall design system.
        </div>
      </Panel>
    </div>
  );
}
