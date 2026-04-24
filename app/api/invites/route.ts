import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

// GET /api/invites?token=<invite_token>
// Accept an invite — creates Membership and marks invite accepted
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/login?error=invalid-invite", request.url));

  const invite = await db.invite.findUnique({ where: { token }, include: { workspace: true } });

  if (!invite || invite.status !== "pending") return NextResponse.redirect(new URL("/login?error=invite-expired", request.url));
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await db.invite.update({ where: { id: invite.id }, data: { status: "revoked" } });
    return NextResponse.redirect(new URL("/login?error=invite-expired", request.url));
  }

  // Find user by email (must be registered)
  const user = await db.user.findUnique({ where: { email: invite.email } });
  if (!user) {
    // Redirect to register with email prefilled
    return NextResponse.redirect(new URL(`/create-account?email=${encodeURIComponent(invite.email)}&invite=${token}`, request.url));
  }

  // Check session — must be logged in as the invited email
  const session = await getSession();
  if (!session || session.email !== invite.email) {
    return NextResponse.redirect(new URL(`/login?redirect=/api/invites?token=${token}`, request.url));
  }

  // Create membership if not already exists
  await db.membership.upsert({
    where: { userId_workspaceId: { userId: user.id, workspaceId: invite.workspaceId } },
    create: { userId: user.id, workspaceId: invite.workspaceId, role: invite.role },
    update: { role: invite.role },
  });

  await db.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });

  await db.auditEvent.create({
    data: { workspaceId: invite.workspaceId, userId: user.id, action: "invite.accepted", details: `${user.email} joined as ${invite.role}` },
  });

  return NextResponse.redirect(new URL(`/workspace/${invite.workspaceId}/${invite.workspace.slug}/overview`, request.url));
}
