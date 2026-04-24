import { NextRequest, NextResponse } from "next/server";
import { searchLogEvents } from "@/lib/search";
import { getSession } from "@/lib/auth";

// FIX #4 — Input size limits on the search API route.
// A 10,000-char query would be passed straight into a Prisma contains call,
// causing a very slow regex with no timeout. Cap the query string here.
const MAX_QUERY_LEN = 500;
const MAX_LIMIT      = 200;

export async function GET(request: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  // FIX: require an authenticated session before any DB work
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });

  const { workspaceId } = await params;
  const { searchParams } = new URL(request.url);

  const rawQuery = searchParams.get("q") || undefined;
  const query = rawQuery ? rawQuery.slice(0, MAX_QUERY_LEN) : undefined;

  // Clamp limit to a safe ceiling
  const rawLimit = Number(searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), MAX_LIMIT);

  const result = await searchLogEvents({
    workspaceId,
    query,
    level:       searchParams.get("level")       || undefined,
    application: searchParams.get("application") || undefined,
    environment: searchParams.get("environment") || undefined,
    traceId:     searchParams.get("traceId")     || undefined,
    containsPii:
      searchParams.get("containsPii") === "true"  ? true  :
      searchParams.get("containsPii") === "false" ? false : undefined,
    from:   searchParams.get("from")   || undefined,
    to:     searchParams.get("to")     || undefined,
    limit,
    cursor: searchParams.get("cursor") || undefined,
  });

  return NextResponse.json(result);
}
