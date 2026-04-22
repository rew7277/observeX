import { Panel } from "@/components/panel";
import { InviteMemberForm } from "@/components/forms";
import { requireUser } from "@/lib/auth";
import { getWorkspaceContext } from "@/lib/workspace";

export default async function TeamPage({ params }: { params: Promise<{ workspaceId: string; slug: string }>; }) {
  const user = await requireUser();
  const { workspaceId, slug } = await params;
  const { workspace } = await getWorkspaceContext(workspaceId, slug, user.id);

  return (
    <div className="space-y-6">
      <header>
        <div className="badge"><span className="h-2 w-2 rounded-full bg-cyan-300 animate-pulse" /> Team and access</div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Members, roles, and invitations</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-400 md:text-base">Bring teammates into the workspace with owner/admin/developer/tester/manager/viewer roles.</p>
      </header>
      <Panel className="p-5 md:p-6">
        <div className="text-lg font-semibold">Invite new member</div>
        <div className="mt-4"><InviteMemberForm workspaceId={workspaceId} /></div>
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Current members</div>
          <div className="mt-5 space-y-3">
            {workspace.memberships.map((member) => (
              <div key={member.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{member.user.name}</div>
                    <div className="mt-1 text-xs text-slate-400">{member.user.email}</div>
                  </div>
                  <div className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 capitalize">{member.role}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel className="p-5 md:p-6">
          <div className="text-lg font-semibold">Pending invites</div>
          <div className="mt-5 space-y-3">
            {workspace.invites.map((invite) => (
              <div key={invite.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium">{invite.email}</div>
                    <div className="mt-1 text-xs text-slate-400">Created {new Date(invite.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-300 capitalize">{invite.role}</div>
                </div>
              </div>
            ))}
            {!workspace.invites.length ? <div className="text-sm text-slate-400">No invites yet.</div> : null}
          </div>
        </Panel>
      </div>
    </div>
  );
}
