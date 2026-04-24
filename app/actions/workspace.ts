"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { alertRuleSchema, apiSourceSchema, inviteSchema, workspaceProfileSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createOpaqueToken, sanitizeFreeText, isSafeHttpUrl } from "@/lib/security";
import { z } from "zod";

async function getAllowedMembership(workspaceId: string, userId: string) {
  return db.membership.findFirst({ where: { workspaceId, userId } });
}

async function refreshWorkspace(workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;
  const base = `/workspace/${workspace.id}/${workspace.slug}`;
  ["overview", "settings", "team", "sources", "billing", "alerts", "security", "live-logs",
   "flow-analytics", "search", "anomalies", "incidents", "latency", "compare", "trace-explorer",
   "pii-scanner", "exports", "quotas"].forEach((page) => revalidatePath(`${base}/${page}`));
}

export async function updateWorkspaceProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = workspaceProfileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"), slug: formData.get("slug"),
    description: formData.get("description"), billingEmail: formData.get("billingEmail"),
    domain: formData.get("domain"), retentionDays: formData.get("retentionDays"),
    ingestionMode: formData.get("ingestionMode"), logStorageMode: formData.get("logStorageMode"),
    maxMonthlyIngestMb: formData.get("maxMonthlyIngestMb"), maxUsers: formData.get("maxUsers"),
    s3Bucket: formData.get("s3Bucket"), s3Region: formData.get("s3Region"), s3Prefix: formData.get("s3Prefix"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Invalid settings." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "workspace:update")) return { ok: false, message: "No permission." };

  await db.workspace.update({
    where: { id: parsed.data.workspaceId },
    data: {
      name: sanitizeFreeText(parsed.data.name, 80), slug: slugify(parsed.data.slug),
      description: parsed.data.description || null, billingEmail: parsed.data.billingEmail || null,
      domain: parsed.data.domain || null, retentionDays: parsed.data.retentionDays,
      ingestionMode: parsed.data.ingestionMode, logStorageMode: parsed.data.logStorageMode,
      maxMonthlyIngestMb: parsed.data.maxMonthlyIngestMb, maxUsers: parsed.data.maxUsers,
      s3Bucket: parsed.data.s3Bucket || null, s3Region: parsed.data.s3Region || null, s3Prefix: parsed.data.s3Prefix || null,
    },
  });
  await db.auditEvent.create({ data: { workspaceId: parsed.data.workspaceId, userId: user.id, action: "workspace.updated", details: "Profile updated" } });
  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Workspace settings saved." };
}

export async function createInviteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse({ workspaceId: formData.get("workspaceId"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { ok: false, message: "Invalid invite details." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "member:invite")) return { ok: false, message: "No permission." };

  // ✅ Rate-limit: max 20 pending invites per workspace
  const pendingCount = await db.invite.count({ where: { workspaceId: parsed.data.workspaceId, status: "pending" } });
  if (pendingCount >= 20) return { ok: false, message: "Too many pending invites. Accept or revoke some first." };

  const token = createOpaqueToken("invite");
  await db.invite.create({
    data: { workspaceId: parsed.data.workspaceId, email: parsed.data.email, role: parsed.data.role, createdById: user.id, token, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) },
  });
  await db.auditEvent.create({ data: { workspaceId: parsed.data.workspaceId, userId: user.id, action: "invite.created", details: `Invite for ${parsed.data.email} as ${parsed.data.role}` } });

  // Invite link for display (in real app, email this link)
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/invites?token=${token}`;
  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: `Invite created. Link: ${inviteLink}` };
}

export async function createApiSourceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = apiSourceSchema.safeParse({
    workspaceId: formData.get("workspaceId"), name: formData.get("name"), type: formData.get("type"),
    endpointUrl: formData.get("endpointUrl"), bucketName: formData.get("bucketName"),
    region: formData.get("region"), prefix: formData.get("prefix"),
    schedule: formData.get("schedule"), authType: formData.get("authType"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Invalid source details." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "source:write")) return { ok: false, message: "No permission." };

  const source = await db.apiSource.create({
    data: {
      workspaceId: parsed.data.workspaceId, name: sanitizeFreeText(parsed.data.name, 80),
      type: parsed.data.type, endpointUrl: parsed.data.endpointUrl || null,
      bucketName: parsed.data.bucketName || null, region: parsed.data.region || null,
      prefix: parsed.data.prefix || null, schedule: parsed.data.schedule || null,
      authType: parsed.data.authType || "none",
      secretRef: `secret://${parsed.data.workspaceId}/${slugify(parsed.data.name)}-${Date.now()}`,
    },
  });

  await db.sourceRun.create({ data: { workspaceId: parsed.data.workspaceId, apiSourceId: source.id, status: "paused", errorMessage: "Health test pending." } });
  await db.auditEvent.create({ data: { workspaceId: parsed.data.workspaceId, userId: user.id, action: "source.created", details: `${parsed.data.name} added` } });
  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Source added." };
}

export async function createAlertRuleAction(formData: FormData) {
  const user = await requireUser();
  const parsed = alertRuleSchema.safeParse({
    workspaceId: formData.get("workspaceId"), name: formData.get("name"),
    metric: formData.get("metric"), operator: formData.get("operator"),
    threshold: formData.get("threshold"), severity: formData.get("severity"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Invalid alert rule." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "alert:write")) return { ok: false, message: "No permission." };

  await db.alertRule.create({ data: { name: parsed.data.name, metric: parsed.data.metric, operator: parsed.data.operator, threshold: parsed.data.threshold, severity: parsed.data.severity, workspace: { connect: { id: parsed.data.workspaceId } } } });
  await db.auditEvent.create({ data: { workspaceId: parsed.data.workspaceId, userId: user.id, action: "alert-rule.created", details: parsed.data.name } });
  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Alert rule created." };
}

const alertChannelSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  type: z.enum(["webhook", "email", "slack"]),
  destination: z.string().trim().min(3).max(500),
});

export async function createAlertChannelAction(formData: FormData) {
  const user = await requireUser();
  const parsed = alertChannelSchema.safeParse({
    workspaceId: formData.get("workspaceId"), name: formData.get("name"),
    type: formData.get("type"), destination: formData.get("destination"),
  });
  if (!parsed.success) return { ok: false, message: "Invalid channel details." };

  if ((parsed.data.type === "webhook" || parsed.data.type === "slack") && !isSafeHttpUrl(parsed.data.destination)) {
    return { ok: false, message: "Destination must be a valid HTTPS URL." };
  }

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "alert:write")) return { ok: false, message: "No permission." };

  await db.alertChannel.create({ data: { workspaceId: parsed.data.workspaceId, name: sanitizeFreeText(parsed.data.name, 80), type: parsed.data.type, destination: parsed.data.destination } });
  await db.auditEvent.create({ data: { workspaceId: parsed.data.workspaceId, userId: user.id, action: "alert-channel.created", details: `${parsed.data.name} (${parsed.data.type})` } });
  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Alert channel created." };
}
