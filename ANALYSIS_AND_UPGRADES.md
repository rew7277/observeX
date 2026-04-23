# ObserveX Deep Analysis & Upgrade Guide

## Executive Summary

ObserveX is a solid Next.js 15 SaaS observability platform with multi-tenant workspaces, log ingestion, PII masking, anomaly detection, and alert rules. The architecture is clean and the Prisma schema is well-structured. Below is a thorough audit across every layer with concrete upgrades applied.

---

## 1. Critical Issues Found

### 1.1 Webhook API — No Authentication
**File:** `app/api/ingest/webhook/route.ts`

The POST endpoint accepts any `workspaceId` without verifying the caller owns it. Any actor who knows a workspace ID can inject arbitrary log events.

**Fix:** Validate the `Authorization: Bearer <apiKey>` header against the `ApiKey` table using a constant-time hash comparison.

### 1.2 Anomaly Detection — Approximate p95 is Wrong
**File:** `lib/alerts-engine.ts`

```ts
p95Latency: Math.round(anomaly.summary.avgLatency * 1.4),
```
This is a fabricated estimate. The real p95 must be computed from actual latency values.

**Fix:** Export `getLatencyInsights` from `lib/latency.ts` and use the real p95 value inside the alert engine.

### 1.3 Upload Model Stores Full `rawText` in PostgreSQL
**File:** `prisma/schema.prisma` — `Upload.rawText String`

Raw log files can be megabytes. Storing them as unbounded strings in Postgres bloats the database, hurts query performance on surrounding columns, and will hit row-size limits for large uploads.

**Fix:** Add `rawTextSizeBytes Int @default(0)` and conditionally store only a `rawTextPreview String?` (first 4 KB), using S3 for the full payload when `logStorageMode = "s3"`.

### 1.4 `getWorkspaceContext` — N+1 Potential on `parsedJson` Fallback
**File:** `lib/workspace.ts`

When `logEvent` table is empty the code reads `upload.parsedJson` from every upload. Those JSON columns can be large. The `parsedJson` field on `Upload` stores the entire parsed record array per upload, duplicating what is already in `LogEvent`.

**Fix:** Remove the `parsedJson` fallback path; always rely on `LogEvent`. Keep a lightweight `summaryJson` column only.

### 1.5 Session Version Check Missing MFA Gate
**File:** `lib/auth.ts`

The `requireUser` function checks `sessionVersion` correctly, but `mfaEnabled` is stored on the user and never enforced anywhere. Any user with `mfaEnabled: true` can still log in with just a password.

**Fix:** Check `user.mfaEnabled` in `requireUser` and gate TOTP validation through a second session step.

---

## 2. Performance Improvements

### 2.1 Search — Full-Text vs ILIKE
**File:** `lib/search.ts`

All text searches use Prisma `contains` which compiles to `ILIKE '%query%'`. This prevents index use and causes sequential scans on large `LogEvent` tables.

**Fix:** Add a `tsvector` generated column to `LogEvent` and a GIN index. Fall back to `ILIKE` only for short queries.

```sql
ALTER TABLE "LogEvent" ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', message || ' ' || application || ' ' || "traceId")) STORED;
CREATE INDEX log_event_search_vector_idx ON "LogEvent" USING GIN(search_vector);
```

### 2.2 Anomaly & Latency Queries — Duplicate DB Reads
`alerts-engine.ts` calls `detectWorkspaceAnomalies` which calls `db.logEvent.findMany(take: 5000)`. The latency page calls `getLatencyInsights` which also calls `db.logEvent.findMany(take: 5000)`. On every page render this means two 5000-row fetches for the same data.

**Fix:** Introduce a lightweight `getWorkspaceMetricsSnapshot(workspaceId)` that runs both in a single query and is cached with `unstable_cache`.

### 2.3 Ingestion Batch Size
**File:** `lib/ingestion.ts`

```ts
const INSERT_BATCH_SIZE = 2000;
```
Prisma `createMany` with 2000 rows per batch is reasonable, but there is no transaction wrapping the multi-batch loop. A failure mid-way leaves partial data with no rollback.

**Fix:** Wrap multi-batch inserts in `db.$transaction(...)`.

### 2.4 Log Metrics Timeline Resolution
**File:** `lib/log-parser.ts`

The timeline groups by hour (`slice(0, 13)`). For uploads covering less than 3 hours all events collapse into one bucket making charts useless.

**Fix:** Auto-detect the time span and use minute-level bucketing for spans < 4 hours, hour-level for < 7 days, day-level otherwise.

---

## 3. Security Hardening

### 3.1 PII Detection — Missing Patterns
**File:** `lib/security.ts`

Current patterns miss: phone numbers, IP addresses, AWS access key IDs, JWT tokens, SSH private key headers, Indian passport numbers, and UPI VPAs.

**Fix:** Expand the regex set (see `lib/security.ts` in the upgraded files).

### 3.2 `sanitizeFreeText` Only Strips `<>` 
Strips angle brackets but not other injection vectors (`'`, `"`, backticks, SQL wildcards). Text goes into Prisma parameterized queries so SQL injection is not a risk, but stored XSS in the dashboard UI is.

**Fix:** Use a proper HTML-entity encode instead of stripping.

### 3.3 Invite Token — No Rate Limiting
`createInviteAction` creates invite tokens with no rate limit. An admin can spam-create thousands of invites.

**Fix:** Check existing pending invite count before creating a new one.

### 3.4 Auth Events — Brute-Force Detection Missing
`AuthEvent` records login failures but nothing consumes them to lock accounts.

**Fix:** Add `checkBruteForce(email)` that reads `AuthEvent` for recent failures before password comparison.

---

## 4. Architecture Improvements

### 4.1 Real Background Worker Scaffold
`lib/background-jobs.ts` is a stub with a comment saying "wire to a cron". Add a proper queue-based processor pattern using a `pg-boss`-compatible interface so uploads are processed outside the request lifecycle.

### 4.2 Alert Rule Delivery — No Notification Channel
Alert rules are evaluated but never delivered anywhere (no email, no webhook, no Slack). Add an `AlertChannel` model and a delivery step.

### 4.3 Saved Views — No UI Implementation
`SavedView` model exists in the schema but is never created or read anywhere in the app.

### 4.4 API Key — Last-Used Tracking Not Updated
`ApiKey.lastUsedAt` is defined but never updated when the key is actually used.

**Fix:** Update `lastUsedAt` inside the webhook auth middleware.

---

## 5. Code Quality

### 5.1 `lib/anomaly.ts` — Magic Number Thresholds
Thresholds (15%, 800 ms, 5 events) are inline literals. Extract to a config object so workspace plans can override them.

### 5.2 `buildSignature` — Collision Risk
The signature function produces the same hash for messages that differ only by numbers. "Disk usage 90%" and "Disk usage 10%" get identical signatures. This over-deduplicates noisy signal analysis.

**Fix:** Preserve the first numeric token per message segment as context.

### 5.3 TypeScript `any` Usage
`lib/log-parser.ts` and `lib/workspace.ts` use `any` in several places. Typed alternatives are possible with the existing `LogRecord` type.

---

## 6. Files Upgraded (see sibling files)

| File | Changes |
|------|---------|
| `lib/security.ts` | Expanded PII patterns (phone, IP, AWS keys, JWT, UPI, passport), brute-force check |
| `lib/search.ts` | Full-text search support, fixed facet query scoping |
| `lib/anomaly.ts` | Config-driven thresholds, real p95 from latency module |
| `lib/alerts-engine.ts` | Uses real p95, adds notification channel stub |
| `lib/ingestion.ts` | Transactional batch insert, adaptive timeline resolution |
| `lib/log-parser.ts` | Adaptive timeline bucketing, better signature algorithm |
| `lib/background-jobs.ts` | Real job-queue scaffold for async upload processing |
| `app/api/ingest/webhook/route.ts` | API key authentication, lastUsedAt update, rate-limit header |
| `prisma/schema.prisma` | `AlertChannel`, `AlertDelivery`, search vector hint comment, rawText fix |
| `lib/validators.ts` | Stricter webhook event validation, sanitization helpers |
