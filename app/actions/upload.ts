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
      sourceType: parsed.sourceType,
      rawText: content,
      parsedJson: parsed.records as any
    }
  });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  revalidatePath(`/workspace/${workspaceId}/${workspace?.slug}/overview`);
  revalidatePath(`/workspace/${workspaceId}/${workspace?.slug}/upload`);

  return { ok: true, message: `${fileName} uploaded successfully.` };
}
