# ObserveX SaaS Production Upgrade Notes

This package upgrades the project from a parsed-upload demo pattern toward a safer and more scalable observability SaaS foundation.

## Major upgrades included

- Indexed `LogEvent` storage model for searchable events
- Upload lifecycle with `queued / processing / completed / failed`
- Stronger auth session model with `sessionVersion`
- Auth audit trail and failed login throttling model
- Invite token metadata and expiry fields
- Workspace quotas (`maxMonthlyIngestMb`, `maxUsers`)
- Security detection and masking for common PII / secret patterns
- Source operational metadata and `SourceRun` history
- Richer metrics including P95/P99, anomaly signals, top signatures
- Updated workspace UI surfaces for security, sources, and upload health

## Important follow-up required before deploy

1. Run a Prisma migration against your database:
   - `npx prisma migrate dev --name observex_production_upgrade`
   - or generate SQL and run it in your target environment.
2. Set real environment secrets:
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `ENCRYPTION_KEY`
3. Install dependencies and generate Prisma client:
   - `npm install`
   - `npx prisma generate`
4. Build and test:
   - `npm run build`

## Recommended next phase

- Move ingestion to background workers (BullMQ / Redis)
- Add server-side search API with pagination
- Add S3 raw file storage and retention jobs
- Add email verification / forgot password / MFA
- Add alert execution engine and notification delivery
- Add saved searches and enterprise API keys
