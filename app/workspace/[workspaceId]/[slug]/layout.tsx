import { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { LogoutButton } from "@/components/logout-button";

export default async function WorkspaceLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ workspaceId: string; slug: string }>;
}) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;

  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId }
  });

  if (!workspace || workspace.slug !== slug) notFound();

  const membership = await db.membership.findFirst({
    where: { workspaceId, userId: user.id }
  });

  if (!membership) notFound();

  return (
    <div className="relative z-10 flex min-h-screen">
      <Sidebar workspaceId={workspaceId} slug={slug} />
      <main className="flex-1 p-5 md:p-7 xl:p-8 2xl:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">Workspace</div>
            <div className="text-2xl font-semibold">{workspace.name}</div>
            <div className="mt-1 text-xs text-slate-500">{workspaceId} / {workspace.slug}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
              Signed in as {user.name}
            </div>
            <LogoutButton />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}
