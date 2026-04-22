"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { alertRuleSchema, apiSourceSchema, inviteSchema, workspaceProfileSchema } from "@/lib/validators";
import { hasPermission } from "@/lib/permissions";
import { createOpaqueToken, sanitizeFreeText } from "@/lib/security";

async function getAllowedMembership(workspaceId: string, userId: string) {
  const membership = await db.membership.findFirst({ where: { workspaceId, userId } });
  if (!membership) return null;
  return membership;
}

async function refreshWorkspace(workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;
  const base = `/workspace/${workspace.id}/${workspace.slug}`;
  ["overview", "settings", "team", "sources", "billing", "alerts", "security", "live-logs", "flow-analytics", "search", "anomalies", "incidents", "latency", "compare", "trace-explorer", "pii-scanner", "exports", "quotas"].forEach((page) => revalidatePath(`${base}/${page}`));
}

export async function updateWorkspaceProfileAction(formData: FormData) {
  const user = await requireUser();
  const parsed = workspaceProfileSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description"),
    billingEmail: formData.get("billingEmail"),
    domain: formData.get("domain"),
    retentionDays: formData.get("retentionDays"),
    ingestionMode: formData.get("ingestionMode"),
    logStorageMode: formData.get("logStorageMode"),
    maxMonthlyIngestMb: formData.get("maxMonthlyIngestMb"),
    maxUsers: formData.get("maxUsers"),
    s3Bucket: formData.get("s3Bucket"),
    s3Region: formData.get("s3Region"),
    s3Prefix: formData.get("s3Prefix")
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Please provide valid workspace settings." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "workspace:update")) {
    return { ok: false, message: "You do not have permission to update workspace settings." };
  }

  await db.workspace.update({
    where: { id: parsed.data.workspaceId },
    data: {
      name: sanitizeFreeText(parsed.data.name, 80),
      slug: slugify(parsed.data.slug),
      description: parsed.data.description || null,
      billingEmail: parsed.data.billingEmail || null,
      domain: parsed.data.domain || null,
      retentionDays: parsed.data.retentionDays,
      ingestionMode: parsed.data.ingestionMode,
      logStorageMode: parsed.data.logStorageMode,
      maxMonthlyIngestMb: parsed.data.maxMonthlyIngestMb,
      maxUsers: parsed.data.maxUsers,
      s3Bucket: parsed.data.s3Bucket || null,
      s3Region: parsed.data.s3Region || null,
      s3Prefix: parsed.data.s3Prefix || null
    }
  });

  await db.auditEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      action: "workspace.updated",
      details: "Workspace profile and platform limits updated"
    }
  });

  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Workspace profile updated." };
}

export async function createInviteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = inviteSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    email: formData.get("email"),
    role: formData.get("role")
  });

  if (!parsed.success) return { ok: false, message: "Please provide a valid invite." };
  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "member:invite")) {
    return { ok: false, message: "You do not have permission to invite members." };
  }

  const token = createOpaqueToken("invite");

  await db.invite.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      createdById: user.id,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
    }
  });

  await db.auditEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      action: "invite.created",
      details: `Invite created for ${parsed.data.email} as ${parsed.data.role}`
    }
  });

  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Invite created with expiring token metadata." };
}

export async function createApiSourceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = apiSourceSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    type: formData.get("type"),
    endpointUrl: formData.get("endpointUrl"),
    bucketName: formData.get("bucketName"),
    region: formData.get("region"),
    prefix: formData.get("prefix"),
    schedule: formData.get("schedule"),
    authType: formData.get("authType")
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Please provide valid source details." };
  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "source:write")) {
    return { ok: false, message: "You do not have permission to add sources." };
  }

  const source = await db.apiSource.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: sanitizeFreeText(parsed.data.name, 80),
      type: parsed.data.type,
      endpointUrl: parsed.data.endpointUrl || null,
      bucketName: parsed.data.bucketName || null,
      region: parsed.data.region || null,
      prefix: parsed.data.prefix || null,
      schedule: parsed.data.schedule || null,
      authType: parsed.data.authType || "none",
      secretRef: `secret://${parsed.data.workspaceId}/${slugify(parsed.data.name)}-${Date.now()}`,
      lastError: null
    }
  });

  await db.sourceRun.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      apiSourceId: source.id,
      status: "paused",
      errorMessage: "Connector created. Health test not yet implemented.",
      completedAt: new Date()
    }
  });

  await db.auditEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      action: "source.created",
      details: `${parsed.data.type.toUpperCase()} source ${parsed.data.name} added`
    }
  });

  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Source added with operational metadata." };
}

export async function createAlertRuleAction(formData: FormData) {
  const user = await requireUser();
  const parsed = alertRuleSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    metric: formData.get("metric"),
    operator: formData.get("operator"),
    threshold: formData.get("threshold"),
    severity: formData.get("severity")
  });

  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Please provide valid alert rule details." };
  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !hasPermission(membership.role, "alert:write")) {
    return { ok: false, message: "You do not have permission to create alert rules." };
  }

  await db.alertRule.create({
    data: {
      name: parsed.data.name,
      metric: parsed.data.metric,
      operator: parsed.data.operator,
      threshold: parsed.data.threshold,
      severity: parsed.data.severity,
      workspace: {
        connect: { id: parsed.data.workspaceId }
      }
    }
  });

  await db.auditEvent.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      userId: user.id,
      action: "alert-rule.created",
      details: `${parsed.data.name} added`
    }
  });

  await refreshWorkspace(parsed.data.workspaceId);
  return { ok: true, message: "Alert rule created." };
}
