"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { loginSchema, registerSchema } from "@/lib/validators";
import { slugify } from "@/lib/slug";

export async function registerAction(formData: FormData) {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    workspaceName: formData.get("workspaceName"),
    billingEmail: formData.get("billingEmail")
  });

  if (!parsed.success) {
    return { ok: false, message: "Please provide valid registration details." };
  }

  const { name, email, password, workspaceName, billingEmail } = parsed.data;
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return { ok: false, message: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await db.user.create({
    data: { name, email, passwordHash }
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
      name: workspaceName,
      slug,
      ownerId: user.id,
      billingEmail: billingEmail || email,
      description: "Production-ready observability workspace",
      planTier: "starter",
      retentionDays: 30,
      ingestionMode: "manual-upload",
      logStorageMode: "database"
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

  await createSession({ userId: user.id, email: user.email, name: user.name });
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

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return { ok: false, message: "Invalid email or password." };

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) return { ok: false, message: "Invalid email or password." };

  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
    orderBy: { createdAt: "asc" }
  });

  if (!membership?.workspace) return { ok: false, message: "No workspace found for this account." };

  await createSession({ userId: user.id, email: user.email, name: user.name });
  redirect(`/workspace/${membership.workspace.id}/${membership.workspace.slug}/overview`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
