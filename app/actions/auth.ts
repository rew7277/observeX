"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession, getRequestMeta } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";
import { sanitizeFreeText } from "@/lib/security";

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

async function hasTooManyAttempts(email: string) {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const failed = await db.authEvent.count({
    where: {
      email,
      type: "login_failed",
      createdAt: { gte: since }
    }
  });
  return failed >= MAX_FAILED_ATTEMPTS;
}

async function recordAuthEvent(params: { email: string; type: "login_success" | "login_failed" | "register_success"; userId?: string; success: boolean }) {
  const meta = await getRequestMeta();
  await db.authEvent.create({
    data: {
      email: params.email,
      userId: params.userId,
      type: params.type,
      success: params.success,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent
    }
  });
}

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
    billingEmail: formData.get("billingEmail")
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message || "Please provide valid registration details." };
  }

  const { name, email, password, workspaceName, billingEmail } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await db.user.create({
    data: { name: sanitizeFreeText(name, 80), email, passwordHash }
  });

  const baseSlug = slugify(workspaceName) || "workspace";
  let slug = baseSlug;
  let i = 1;
  while (await db.workspace.findFirst({ where: { ownerId: user.id, slug } })) {
    i += 1;
    slug = `${baseSlug}-${i}`;
  }

  const workspace = await db.workspace.create({
    data: {
      name: sanitizeFreeText(workspaceName, 80),
      slug,
      ownerId: user.id,
      billingEmail: billingEmail || email,
      description: "Secure SaaS observability workspace",
      planTier: "starter",
      retentionDays: 30,
      ingestionMode: "manual-upload",
      logStorageMode: "database",
      maxMonthlyIngestMb: 512,
      maxUsers: 5,
      environmentPolicyJson: { allowed: ["Production", "UAT", "Development", "DR"] }
    }
  });

  await db.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: "owner"
    }
  });

  await db.auditEvent.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      action: "workspace.created",
      details: `Workspace ${workspace.name} created`
    }
  });

  await recordAuthEvent({ email, userId: user.id, type: "register_success", success: true });

  await createSession({ userId: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion });
  redirect(`/workspace/${workspace.id}/${workspace.slug}/overview`);
}

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password")
  });

  if (!parsed.success) {
    return { ok: false, message: "Please provide valid login details." };
  }

  const email = parsed.data.email;
  if (await hasTooManyAttempts(email)) {
    return { ok: false, message: `Too many failed attempts. Please try again in ${WINDOW_MINUTES} minutes.` };
  }

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    await recordAuthEvent({ email, type: "login_failed", success: false });
    return { ok: false, message: "Invalid email or password." };
  }

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) {
    await recordAuthEvent({ email, userId: user.id, type: "login_failed", success: false });
    return { ok: false, message: "Invalid email or password." };
  }

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" }
  });

  if (!membership?.workspace) return { ok: false, message: "No workspace found for this account." };

  await recordAuthEvent({ email, userId: user.id, type: "login_success", success: true });
  await createSession({ userId: user.id, email: user.email, name: user.name, sessionVersion: user.sessionVersion });
  redirect(`/workspace/${membership.workspace.id}/${membership.workspace.slug}/overview`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
