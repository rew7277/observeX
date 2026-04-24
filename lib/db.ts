import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// FIX #13 — Add statement_timeout to the connection string so rogue
// queries don't hang the serverless function until Vercel's 60s kill.
// You can also set this directly in DATABASE_URL: ?statement_timeout=10000
function buildDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("statement_timeout")) {
      parsed.searchParams.set("statement_timeout", "15000"); // 15s
    }
    // FIX #11 — Serverless connection pool guard: prevent "too many connections"
    // on Railway/Vercel. Each cold-start would otherwise open a new PrismaClient.
    if (!parsed.searchParams.has("connection_limit")) {
      parsed.searchParams.set("connection_limit", "5");
    }
    if (!parsed.searchParams.has("pool_timeout")) {
      parsed.searchParams.set("pool_timeout", "10");
    }
    return parsed.toString();
  } catch {
    return url; // return original if URL parsing fails (e.g. non-standard format)
  }
}

export const db =
  global.prisma ??
  new PrismaClient({
    log:       process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    datasources: {
      db: { url: buildDatabaseUrl() },
    },
  });

if (process.env.NODE_ENV !== "production") global.prisma = db;

// FIX #19 — Scoped DB wrapper: enforces workspaceId on LogEvent queries
// so a developer adding a new page can't accidentally expose cross-workspace data.
export function scopedDb(workspaceId: string) {
  if (!workspaceId) throw new Error("scopedDb: workspaceId is required");
  return {
    logEvent: {
      findMany: (args: Parameters<typeof db.logEvent.findMany>[0]) =>
        db.logEvent.findMany({ ...args, where: { ...args?.where, workspaceId } }),
      count: (args?: Parameters<typeof db.logEvent.count>[0]) =>
        db.logEvent.count({ ...args, where: { ...args?.where, workspaceId } }),
      groupBy: (args: Parameters<typeof db.logEvent.groupBy>[0]) =>
        db.logEvent.groupBy({ ...args, where: { ...args?.where, workspaceId } } as Parameters<typeof db.logEvent.groupBy>[0]),
      aggregate: (args: Parameters<typeof db.logEvent.aggregate>[0]) =>
        db.logEvent.aggregate({ ...args, where: { ...args?.where, workspaceId } }),
    },
  };
}
