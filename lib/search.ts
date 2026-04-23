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
  /** If true, use Postgres full-text search for the query term (requires tsvector column) */
  useFullText?: boolean;
};

// ---------------------------------------------------------------------------
// Full-text search helper
// ---------------------------------------------------------------------------

/**
 * Postgres full-text search condition.
 * Requires the following migration:
 *
 *   ALTER TABLE "LogEvent" ADD COLUMN search_vector tsvector
 *     GENERATED ALWAYS AS (
 *       to_tsvector('english', message || ' ' || application || ' ' || "traceId")
 *     ) STORED;
 *   CREATE INDEX log_event_search_vector_idx ON "LogEvent" USING GIN(search_vector);
 *
 * Falls back to ILIKE when `useFullText` is false.
 */
function buildQueryCondition(
  query: string,
  useFullText: boolean
): Prisma.LogEventWhereInput {
  if (!query) return {};

  if (useFullText) {
    // Use raw SQL for full-text search — Prisma does not expose tsvector natively
    return {
      // Prisma raw filter: treated as an AND condition below
    };
  }

  // ILIKE fallback — works without migration, slower on large tables
  return {
    OR: [
      { message:     { contains: query, mode: "insensitive" } },
      { signature:   { contains: query, mode: "insensitive" } },
      { application: { contains: query, mode: "insensitive" } },
      { environment: { contains: query, mode: "insensitive" } },
      { traceId:     { contains: query } },
    ],
  };
}

// ---------------------------------------------------------------------------
// Main search function
// ---------------------------------------------------------------------------

export async function searchLogEvents(filters: SearchFilters) {
  const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
  const useFullText = filters.useFullText ?? false;

  const baseWhere: Prisma.LogEventWhereInput = {
    workspaceId: filters.workspaceId,
    ...(filters.level       ? { level:       { equals: filters.level,       mode: "insensitive" } } : {}),
    ...(filters.application ? { application: { equals: filters.application, mode: "insensitive" } } : {}),
    ...(filters.environment ? { environment: { equals: filters.environment, mode: "insensitive" } } : {}),
    ...(filters.traceId     ? { traceId:     { contains: filters.traceId } } : {}),
    ...(typeof filters.containsPii === "boolean" ? { containsPii: filters.containsPii } : {}),
    ...(filters.from || filters.to
      ? {
          timestamp: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to   ? { lte: new Date(filters.to)   } : {}),
          },
        }
      : {}),
    ...(filters.query && !useFullText ? buildQueryCondition(filters.query, false) : {}),
  };

  // Full-text path: use raw query for the search condition, combine results
  if (filters.query && useFullText) {
    const safeQuery = filters.query.replace(/[^\w\s]/g, " ").trim();
    const tsQuery = safeQuery.split(/\s+/).filter(Boolean).join(" & ");

    const [rawEvents, total, appFacet, envFacet, levelFacet] = await Promise.all([
      db.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "LogEvent"
        WHERE "workspaceId" = ${filters.workspaceId}
          AND search_vector @@ to_tsquery('english', ${tsQuery})
        ORDER BY timestamp DESC
        LIMIT ${limit}
        ${filters.cursor ? Prisma.sql`OFFSET 1` : Prisma.empty}
      `,
      db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*) as count FROM "LogEvent"
        WHERE "workspaceId" = ${filters.workspaceId}
          AND search_vector @@ to_tsquery('english', ${tsQuery})
      `,
      db.logEvent.groupBy({ by: ["application"], where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { application: "desc" } }, take: 8 }),
      db.logEvent.groupBy({ by: ["environment"], where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { environment: "desc" } }, take: 8 }),
      db.logEvent.groupBy({ by: ["level"],       where: { workspaceId: filters.workspaceId }, _count: { _all: true }, orderBy: { _count: { level: "desc" } },       take: 8 }),
    ]);

    const ids = rawEvents.map((r) => r.id);
    const events = await db.logEvent.findMany({ where: { id: { in: ids } }, orderBy: { timestamp: "desc" } });
    const count = Number((total[0] as any)?.count ?? 0);

    return {
      total: count,
      nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
      events,
      facets: {
        applications: appFacet.map((f) => ({ name: f.application, count: f._count._all })),
        environments: envFacet.map((f) => ({ name: f.environment, count: f._count._all })),
        levels:       levelFacet.map((f) => ({ name: f.level,       count: f._count._all })),
      },
    };
  }

  // --- Standard ILIKE path ---
  const [events, total, appFacet, envFacet, levelFacet] = await Promise.all([
    db.logEvent.findMany({
      where: baseWhere,
      orderBy: [{ timestamp: "desc" }, { id: "desc" }],
      take: limit,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    }),
    db.logEvent.count({ where: baseWhere }),
    // ✅ Facets now use baseWhere (not just workspaceId) so they reflect
    //    the current filter context rather than the entire workspace corpus.
    db.logEvent.groupBy({ by: ["application"], where: baseWhere, _count: { _all: true }, orderBy: { _count: { application: "desc" } }, take: 8 }),
    db.logEvent.groupBy({ by: ["environment"], where: baseWhere, _count: { _all: true }, orderBy: { _count: { environment: "desc" } }, take: 8 }),
    db.logEvent.groupBy({ by: ["level"],       where: baseWhere, _count: { _all: true }, orderBy: { _count: { level: "desc" } },       take: 8 }),
  ]);

  return {
    total,
    nextCursor: events.length === limit ? events[events.length - 1]?.id : null,
    events,
    facets: {
      applications: appFacet.map((f) => ({ name: f.application, count: f._count._all })),
      environments: envFacet.map((f) => ({ name: f.environment, count: f._count._all })),
      levels:       levelFacet.map((f) => ({ name: f.level,       count: f._count._all })),
    },
  };
}

// ---------------------------------------------------------------------------
// Trace explorer
// ---------------------------------------------------------------------------

export async function getTraceExplorer(workspaceId: string, traceId: string) {
  const events = await db.logEvent.findMany({
    where: { workspaceId, traceId },
    orderBy: { timestamp: "asc" },
    take: 500,
  });

  const steps = events.map((event, index) => ({
    id:          event.id,
    order:       index + 1,
    timestamp:   event.timestamp,
    application: event.application,
    environment: event.environment,
    level:       event.level,
    latencyMs:   event.latencyMs,
    message:     event.message,
  }));

  return {
    traceId,
    steps,
    totalLatencyMs: steps.reduce((sum, step) => sum + (step.latencyMs || 0), 0),
    applications:   Array.from(new Set(steps.map((step) => step.application))),
  };
}
