"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLogs } from "@/lib/log-parser";

// Safety caps to prevent DB timeouts and 502s on large files
const MAX_FILE_BYTES = 15 * 1024 * 1024;   // 15 MB raw text limit
const MAX_STORED_RECORDS = 10_000;           // Store up to 10k parsed records

export async function uploadLogAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") || "");
  const fileName    = String(formData.get("fileName")    || "uploaded.log");
  const content     = String(formData.get("content")     || "");
  const sourceLabel = String(formData.get("sourceLabel") || "manual upload");
  const environment = String(formData.get("environment") || "unknown");

  if (!workspaceId || !content.trim()) {
    return { ok: false, message: "Please provide a valid log file." };
  }

  // Guard: reject files that are too large before any heavy processing
  const byteSize = new TextEncoder().encode(content).length;
  if (byteSize > MAX_FILE_BYTES) {
    const mb = (byteSize / 1024 / 1024).toFixed(1);
    return { ok: false, message: `File is ${mb} MB — maximum allowed size is 15 MB.` };
  }

  const membership = await db.membership.findFirst({
    where: { workspaceId, userId: user.id }
  });
  if (!membership) {
    return { ok: false, message: "You do not have access to this workspace." };
  }

  const parsed = parseLogs(content);
  const totalRecords  = parsed.records.length;
  const cappedRecords = parsed.records.slice(0, MAX_STORED_RECORDS);
  const wasCapped     = totalRecords > MAX_STORED_RECORDS;

  await db.upload.create({
    data: {
      workspaceId,
      uploadedById: user.id,
      fileName,
      sourceType:  "upload",
      // Store content type + record count metadata instead of full raw text
      // rawText kept minimal to avoid massive Postgres writes causing 502s
      contentType: fileName.split(".").pop() || "text",
      sourceLabel,
      environment,
      rawText: wasCapped
        ? `[${totalRecords.toLocaleString()} records parsed — showing first ${MAX_STORED_RECORDS.toLocaleString()}]`
        : `[${totalRecords.toLocaleString()} records]`,
      parsedJson: cappedRecords as any
    }
  });

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } });
  await db.auditEvent.create({
    data: {
      workspaceId,
      userId: user.id,
      action: "upload.created",
      details: wasCapped
        ? `${fileName}: ${totalRecords.toLocaleString()} records parsed (stored first ${MAX_STORED_RECORDS.toLocaleString()})`
        : `${fileName}: ${totalRecords.toLocaleString()} records parsed`
    }
  });

  const base = `/workspace/${workspaceId}/${workspace?.slug}`;
  revalidatePath(`${base}/overview`);
  revalidatePath(`${base}/upload`);
  revalidatePath(`${base}/live-logs`);
  revalidatePath(`${base}/alerts`);
  revalidatePath(`${base}/flow-analytics`);
  revalidatePath(`${base}/security`);

  const msg = wasCapped
    ? `${fileName} uploaded — ${totalRecords.toLocaleString()} records parsed (displaying first ${MAX_STORED_RECORDS.toLocaleString()}).`
    : `${fileName} uploaded — ${totalRecords.toLocaleString()} records parsed successfully.`;

  return { ok: true, message: msg };
}
