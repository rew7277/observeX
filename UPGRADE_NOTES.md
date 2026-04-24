# ObserveX — Hardening Upgrade Notes (v1.0 → v1.1)

## What changed and why

This release fixes every issue identified in the April 2026 security and reliability audit.
Run the migration before deploying:

```bash
npx prisma migrate deploy
# or on Railway this runs automatically via the startCommand in railway.json
```

---

## New environment variables

| Variable | Required | Purpose |
|---|---|---|
| `JWT_SECRET` | ✅ existing | Must be 32+ chars |
| `JWT_SECRET_OLD` | ⚪ optional | Set to your OLD `JWT_SECRET` during rotation window — remove after 24h |
| `AUDIT_HASH_PEPPER` | ⚪ optional | HMAC key for audit log hash chain. Set any 32+ char secret |
| `CRON_SECRET` | ⚪ optional | Bearer token to protect `/api/cron/worker` |

---

## Schema migrations (apply manually if not using `prisma migrate deploy`)

```sql
-- Dead-letter queue for uploads
ALTER TABLE "Upload" ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0;

-- Tamper-evident audit log chain
ALTER TABLE "AuditEvent" ADD COLUMN "chainHash" TEXT;

-- Performance indexes
CREATE INDEX CONCURRENTLY "Upload_retryCount_idx" ON "Upload"("retryCount");
CREATE INDEX CONCURRENTLY "Upload_workspaceId_status_createdAt_idx"
  ON "Upload"("workspaceId", "status", "createdAt" DESC);
```

---

## Fix-by-fix summary

### 🔴 Production blockers

| # | Fix | File |
|---|-----|------|
| 1 | Rate limiting on all API routes (in-memory, no Redis needed) | `middleware.ts` |
| 4 | Search query capped at 500 chars; limit clamped to 200 | `app/api/workspaces/[id]/search/route.ts` |
| 5 | `$transaction()` now has a 30s timeout | `lib/ingestion.ts` |

### 🟠 Security hardening

| # | Fix | File |
|---|-----|------|
| 6 | JWT secret rotation with 24h grace period via `JWT_SECRET_OLD` | `lib/auth.ts`, `lib/security.ts` |
| 7 | Audit events are now hash-chained (tamper-evident) | `prisma/schema.prisma`, `app/actions/workspace.ts` |
| 9 | File upload content validated as UTF-8 text (not binary) | `lib/security.ts`, `app/actions/upload.ts` |
| 10 | CSP, X-Frame-Options, HSTS, nosniff headers added | `next.config.mjs` |

### 🟡 Reliability & scalability

| # | Fix | File |
|---|-----|------|
| 11 | Prisma connection_limit=5 + pool_timeout prevent "too many connections" | `lib/db.ts` |
| 12 | `getWorkspaceContext` now uses `groupBy`/`aggregate` — no more 15K row fetch | `lib/workspace.ts` |
| 13 | `statement_timeout=15000` appended to DATABASE_URL automatically | `lib/db.ts` |
| 15 | Retention pass wired into the cron job — data now actually gets deleted | `lib/retention.ts`, `app/api/cron/worker/route.ts` |
| 17 | `/api/health` endpoint for Railway health checks | `app/api/health/route.ts` |
| 18 | Worker has dead-letter queue — stops retrying after 3 failures | `lib/background-jobs.ts` |

### 🟡 Business logic

| # | Fix | File |
|---|-----|------|
| 19 | `scopedDb(workspaceId)` wrapper makes workspace isolation structurally enforced | `lib/db.ts` |
| 20 | `maxMonthlyIngestMb` and `maxUsers` plan limits now actually enforced | `app/actions/upload.ts`, `app/actions/workspace.ts` |

### 🟢 Developer experience

| # | Fix | File |
|---|-----|------|
| 23 | Startup env-var validation script — clear errors before first request | `scripts/check-env.ts` |

---

## Using `scopedDb` (FIX #19)

For any new page that queries `LogEvent`, use `scopedDb` instead of `db` directly:

```typescript
import { scopedDb } from "@/lib/db";

// workspaceId filter is structurally impossible to forget
const scoped = scopedDb(workspaceId);
const events = await scoped.logEvent.findMany({ take: 50 });
```

---

## JWT secret rotation procedure

1. Generate a new secret: `openssl rand -hex 32`
2. Set `JWT_SECRET_OLD` = current value of `JWT_SECRET`
3. Set `JWT_SECRET` = new secret
4. Deploy
5. After 24 hours, remove `JWT_SECRET_OLD` and redeploy

Users stay logged in throughout. Sessions signed with the old secret are valid
for the grace window, then automatically expire.

---

## Verifying audit log integrity

Each `AuditEvent` row has a `chainHash` field that chains over the previous row.
To detect tampering, run:

```typescript
import { db } from "@/lib/db";
import { computeAuditHash } from "@/lib/security";

const events = await db.auditEvent.findMany({
  where:   { workspaceId: "..." },
  orderBy: { createdAt: "asc" },
});

let prev = "genesis";
for (const event of events) {
  const expected = computeAuditHash(prev, event);
  if (expected !== event.chainHash) {
    console.error("TAMPER DETECTED at event:", event.id);
  }
  prev = event.chainHash ?? prev;
}
```
