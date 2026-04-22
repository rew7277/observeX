"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLogs } from "@/lib/log-parser";

export async function uploadLogAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") || "");
  const fileName = String(formData.get("fileName") || "uploaded.log");
  const content = String(formData.get("content") || "");
  const sourceLabel = String(formData.get("sourceLabel") || "manual upload");
  const environment = String(formData.get("environment") || "unknown");

  if (!workspaceId || !content.trim()) {
    return { ok: false, message: "Please provide a valid log file." };
  }

  const membership = await db.membership.findFirst({
    where: { workspaceId, userId: user.id }
  });

  if (!membership) {
    return { ok: false, message: "You do not have access to this workspace." };
  }

  const parsed = parseLogs(content);

  await db.upload.create({
    data: {
      workspaceId,
      uploadedById: user.id,
      fileName,
      sourceType: "upload",
      contentType: fileName.split(".").pop() || "text",
      sourceLabel,
      environment,
      rawText: content,
      parsedJson: parsed.records as any
    }
  });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  await db.auditEvent.create({
    data: {
      workspaceId,
      userId: user.id,
      action: "upload.created",
      details: `${fileName} uploaded with ${parsed.records.length} parsed records`
    }
  });

  const base = `/workspace/${workspaceId}/${workspace?.slug}`;
  revalidatePath(`${base}/overview`);
  revalidatePath(`${base}/upload`);
  revalidatePath(`${base}/live-logs`);
  revalidatePath(`${base}/alerts`);
  revalidatePath(`${base}/flow-analytics`);
  revalidatePath(`${base}/security`);

  return { ok: true, message: `${fileName} uploaded successfully.` };
}
