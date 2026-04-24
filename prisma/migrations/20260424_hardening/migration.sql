-- FIX #18: Dead-letter queue — retryCount on Upload
ALTER TABLE "Upload" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;

-- FIX #7: Audit tamper protection — chainHash on AuditEvent
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "chainHash" TEXT;

-- Performance: index retryCount so the worker query is fast
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Upload_retryCount_idx" ON "Upload"("retryCount");

-- Performance: index for monthly ingest quota check (FIX #20)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Upload_workspaceId_status_createdAt_idx"
  ON "Upload"("workspaceId", "status", "createdAt" DESC);
