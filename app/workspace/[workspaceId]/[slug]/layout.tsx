import { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { getWorkspaceBasic } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";
import { LogoutButton } from "@/components/logout-button";

export default async function WorkspaceLayout({ children, params }: { children: ReactNode; params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  // Use lightweight query — layout only needs workspace name + membership role
  const { workspace, membership } = await getWorkspaceBasic(workspaceId, slug, user.id);

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar workspaceId={workspaceId} slug={workspace.slug} />
      <main className="flex-1 min-w-0 p-5 md:p-7 xl:p-8 2xl:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">Workspace</div>
            <div className="text-2xl font-semibold">{workspace.name}</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
              <span>{workspaceId}</span>
              <span>•</span>
              <span>{workspace.slug}</span>
              <span>•</span>
              <span className="uppercase">{workspace.planTier}</span>
              <span>•</span>
              <span className="capitalize">{membership.role}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">Signed in as {user.name}</div>
            <LogoutButton />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
