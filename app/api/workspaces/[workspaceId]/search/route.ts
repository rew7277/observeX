import { NextRequest, NextResponse } from "next/server";
import { searchLogEvents } from "@/lib/search";

export async function GET(request: NextRequest, { params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const { searchParams } = new URL(request.url);
  const result = await searchLogEvents({
    workspaceId,
    query: searchParams.get("q") || undefined,
    level: searchParams.get("level") || undefined,
    application: searchParams.get("application") || undefined,
    environment: searchParams.get("environment") || undefined,
    traceId: searchParams.get("traceId") || undefined,
    containsPii: searchParams.get("containsPii") === "true" ? true : searchParams.get("containsPii") === "false" ? false : undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
    limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 50,
    cursor: searchParams.get("cursor") || undefined,
  });

  return NextResponse.json(result);
}
