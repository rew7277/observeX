import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return new Response("Missing workspaceId", { status: 400 });

  // Verify membership
  const membership = await db.membership.findFirst({ where: { workspaceId, userId: session.userId } });
  if (!membership) return new Response("Forbidden", { status: 403 });

  const encoder = new TextEncoder();
  let lastId: string | null = null;
  let closed = false;

  request.signal.addEventListener("abort", () => { closed = true; });

  const stream = new ReadableStream({
    async start(controller) {
      // Send last 50 events immediately on connect
      const initial = await db.logEvent.findMany({
        where: { workspaceId },
        orderBy: { timestamp: "desc" },
        take: 50,
        select: { id: true, timestamp: true, level: true, application: true, environment: true, traceId: true, latencyMs: true, message: true },
      });

      if (initial.length > 0) lastId = initial[0].id;

      const initPayload = JSON.stringify({ type: "init", events: initial.reverse() });
      controller.enqueue(encoder.encode(`data: ${initPayload}\n\n`));

      // Poll for new events every 3 seconds
      const poll = async () => {
        while (!closed) {
          await new Promise((r) => setTimeout(r, 3000));
          if (closed) break;

          try {
            const newEvents = await db.logEvent.findMany({
              where: { workspaceId, ...(lastId ? { id: { gt: lastId } } : {}) },
              orderBy: { createdAt: "asc" },
              take: 20,
              select: { id: true, timestamp: true, level: true, application: true, environment: true, traceId: true, latencyMs: true, message: true },
            });

            if (newEvents.length > 0) {
              lastId = newEvents[newEvents.length - 1].id;
              const payload = JSON.stringify({ type: "events", events: newEvents });
              controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            } else {
              // Heartbeat
              controller.enqueue(encoder.encode(`: heartbeat\n\n`));
            }
          } catch {
            break;
          }
        }
        controller.close();
      };

      poll();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
