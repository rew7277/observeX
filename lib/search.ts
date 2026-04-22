import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type SearchFilters = {
  workspaceId: string;
  query?: string;
  level?: string;
  application?: string;
  environment?: string;
  traceId?: string;
  containsPii?: boolean;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
};

export async function searchLogEvents(filters: SearchFilters) {
  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
  const where: Prisma.LogEventWhereInput = {
    workspaceId: filters.workspaceId,
    ...(filters.level ? { level: { equals: filters.level, mode: "insensitive" } } : {}),
    ...(filters.application ? { application: { equals: filters.application, mode: "insensitive" } } : {}),
    ...(filters.environment ? { environment: { equals: filters.environment, mode: "insensitive" } } : {}),
    ...(filters.traceId ? { traceId: { contains: filters.traceId } } : {}),
    ...(typeof filters.containsPii === "boolean" ? { containsPii: filters.containsPii } : {}),
    ...(filters.from || filters.to ? {
      timestamp: {
        ...(filters.from ? { gte: new Date(filters.from) } : {}),
        ...(filters.to ? { lte: new Date(filters.to) } : {}),
      },
    } : {}),
    ...(filters.query ? {
      OR: [
        { message: { contains: filters.query, mode: "insensitive" } },
        { signature: { contains: filters.query, mode: "insensitive" } },
        { application: { contains: filters.query, mode: "insensitive" } },
        { environment: { contains: filters.query, mode: "insensitive" } },
        { traceId: { contains: filters.query } },
      ],
    } : {}),
  };

  const [events, total, appFacet, envFacet, levelFacet] = await Promise.all([
    db.logEvent.findMany({
      where,
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    }),
    db.logEvent.count({ where }),
    db.logEvent.groupBy({ by: ["application"], where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { application: "desc" } }, take: 8 }),
    db.logEvent.groupBy({ by: ["environment"], where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { environment: "desc" } }, take: 8 }),
    db.logEvent.groupBy({ by: ["level"], where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { level: "desc" } }, take: 8 }),
  ]);

  return {
    total,
    nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
    events,
    facets: {
      applications: appFacet.map((item) => ({ name: item.application, count: item._count._all })),
      environments: envFacet.map((item) => ({ name: item.environment, count: item._count._all })),
      levels: levelFacet.map((item) => ({ name: item.level, count: item._count._all })),
    },
  };
}

export async function getTraceExplorer(workspaceId: string, traceId: string) {
  const events = await db.logEvent.findMany({
    where: { workspaceId, traceId },
    orderBy: { timestamp: "asc" },
    take: 500,
  });

  const steps = events.map((event, index) => ({
    id: event.id,
    order: index + 1,
    timestamp: event.timestamp,
    application: event.application,
    environment: event.environment,
    level: event.level,
    latencyMs: event.latencyMs,
    message: event.message,
  }));

  return {
    traceId,
    steps,
    totalLatencyMs: steps.reduce((sum, step) => sum + (step.latencyMs || 0), 0),
    applications: Array.from(new Set(steps.map((step) => step.application))),
  };
}
