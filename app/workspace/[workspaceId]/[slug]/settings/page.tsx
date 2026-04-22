import { Panel } from "@/components/panel";
import { WorkspaceProfileForm } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function SettingsPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Workspace settings</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Workspace profile and infrastructure settings</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Configure the business and platform side of the workspace — naming, retention, storage mode, S3 archive fields, and ingestion behaviour.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">General settings</div>
        <div className="mt-4"><WorkspaceProfileForm workspace={workspace} /></div>
      </Panel>
    </div>
  );
}
