"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { alertRuleSchema, apiSourceSchema, inviteSchema, workspaceProfileSchema } from "@/lib/validators";

async function getAllowedMembership(workspaceId: string, userId: string) {
  const membership = await db.membership.findFirst({
    where: { workspaceId, userId }
  });
  if (!membership) return null;
  return membership;
}

async function refreshWorkspace(workspaceId: string) {
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return;
  const base = `/workspace/${workspace.id}/${workspace.slug}`;
  ["overview", "settings", "team", "sources", "billing", "alerts"].forEach((page) => revalidatePath(`${base}/${page}`));
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
    s3Bucket: formData.get("s3Bucket"),
    s3Region: formData.get("s3Region"),
    s3Prefix: formData.get("s3Prefix")
  });

  if (!parsed.success) return { ok: false, message: "Please provide valid workspace settings." };

  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
    return { ok: false, message: "Only owners, admins, or managers can update workspace settings." };
  }

  await db.workspace.update({
    where: { id: parsed.data.workspaceId },
    data: {
      name: parsed.data.name,
      slug: slugify(parsed.data.slug),
      description: parsed.data.description || null,
      billingEmail: parsed.data.billingEmail || null,
      domain: parsed.data.domain || null,
      retentionDays: parsed.data.retentionDays,
      ingestionMode: parsed.data.ingestionMode,
      logStorageMode: parsed.data.logStorageMode,
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
      details: "Workspace profile updated"
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
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { ok: false, message: "Only owners and admins can invite members." };
  }

  await db.invite.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      email: parsed.data.email,
      role: parsed.data.role,
      createdById: user.id
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
  return { ok: true, message: "Invite created." };
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

  if (!parsed.success) return { ok: false, message: "Please provide valid source details." };
  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !["owner", "admin", "developer"].includes(membership.role)) {
    return { ok: false, message: "Only owners, admins, or developers can add sources." };
  }

  await db.apiSource.create({
    data: {
      workspaceId: parsed.data.workspaceId,
      name: parsed.data.name,
      type: parsed.data.type,
      endpointUrl: parsed.data.endpointUrl || null,
      bucketName: parsed.data.bucketName || null,
      region: parsed.data.region || null,
      prefix: parsed.data.prefix || null,
      schedule: parsed.data.schedule || null,
      authType: parsed.data.authType || "none"
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
  return { ok: true, message: "Source added." };
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

  if (!parsed.success) return { ok: false, message: "Please provide valid alert rule details." };
  const membership = await getAllowedMembership(parsed.data.workspaceId, user.id);
  if (!membership || !["owner", "admin", "manager"].includes(membership.role)) {
    return { ok: false, message: "Only owners, admins, or managers can create alert rules." };
  }

  await db.alertRule.create({
    data: parsed.data
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
