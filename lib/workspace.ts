import { db } from "@/lib/db";
import { buildMetrics, LogRecord } from "@/lib/log-parser";
import { notFound } from "next/navigation";

// Cap total records in memory across all uploads to prevent OOM on overview
const MAX_OVERVIEW_RECORDS = 50_000;

/** Lightweight query for the layout shell — no uploads, no records processing */
export async function getWorkspaceBasic(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      planTier: true,
      memberships: {
        where: { userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!workspace || workspace.slug !== slug) notFound();
  const membership = workspace.memberships[0];
  if (!membership) notFound();

  return { workspace, membership };
}

export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invites:     { orderBy: { createdAt: "desc" }, take: 10 },
      apiSources:  { orderBy: { createdAt: "desc" }, take: 10 },
      alertRules:  { orderBy: { createdAt: "desc" }, take: 10 },
      uploads:     { orderBy: { createdAt: "desc" }, take: 20 },
      auditEvents: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 }
    }
  });

  if (!workspace || workspace.slug !== slug) notFound();

  const membership = workspace.memberships.find((item) => item.userId === userId);
  if (!membership) notFound();

  // Flatten all upload records but cap total to avoid memory overload
  let total = 0;
  const records: LogRecord[] = [];
  for (const upload of workspace.uploads) {
    const rows = (upload.parsedJson as LogRecord[]) || [];
    const remaining = MAX_OVERVIEW_RECORDS - total;
    if (remaining <= 0) break;
    records.push(...rows.slice(0, remaining));
    total += rows.length;
  }

  const metrics = buildMetrics(records);

  return { workspace, membership, records, metrics };
}
