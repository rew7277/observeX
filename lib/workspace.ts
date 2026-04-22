import { db } from "@/lib/db";
import { buildMetrics, LogRecord } from "@/lib/log-parser";
import { notFound } from "next/navigation";

export async function getWorkspaceContext(workspaceId: string, slug: string, userId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: { include: { user: true }, orderBy: { createdAt: "asc" } },
      invites: { orderBy: { createdAt: "desc" }, take: 10 },
      apiSources: { orderBy: { createdAt: "desc" }, take: 10 },
      alertRules: { orderBy: { createdAt: "desc" }, take: 10 },
      uploads: { orderBy: { createdAt: "desc" }, take: 20 },
      auditEvents: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 }
    }
  });

  if (!workspace || workspace.slug !== slug) notFound();

  const membership = workspace.memberships.find((item) => item.userId === userId);
  if (!membership) notFound();

  const records = workspace.uploads.flatMap((upload) => (upload.parsedJson as LogRecord[]) || []);
  const metrics = buildMetrics(records);

  return { workspace, membership, records, metrics };
}
