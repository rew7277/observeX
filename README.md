# ObserveX SaaS V2

ObserveX is a production-ready SaaS starter for log intelligence and observability teams.

## What V2 adds
- Premium landing page, login, and create-account flow
- Cookie-based JWT authentication
- Workspace-aware SaaS URL structure
- Drag & drop log upload with source label and environment tagging
- Parsing for plain text logs, JSON lines, JSON arrays, and record-wrapper JSON payloads
- Visual dashboards generated from uploaded logs
- Team and role model
- Workspace invites
- API / S3 source configuration foundation
- Billing-ready workspace plan model
- Audit trail table for product actions
- PostgreSQL + Prisma
- Railway-friendly deployment

## Tech stack
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL
- Recharts

## 1) Local setup
```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## 2) Required environment variables
```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-long-random-secret
NEXT_PUBLIC_APP_NAME=ObserveX
```

## 3) Railway deployment
1. Push this project to GitHub
2. Create a new Railway project from GitHub
3. Add a PostgreSQL service in Railway
4. Set the `DATABASE_URL` from Railway Postgres
5. Set `JWT_SECRET`
6. Deploy

The build script already runs:
```bash
prisma generate && prisma db push && next build
```

## 4) Main routes
- `/`
- `/login`
- `/create-account`
- `/workspace/[workspaceId]/[slug]/overview`
- `/workspace/[workspaceId]/[slug]/upload`
- `/workspace/[workspaceId]/[slug]/live-logs`
- `/workspace/[workspaceId]/[slug]/flow-analytics`
- `/workspace/[workspaceId]/[slug]/alerts`
- `/workspace/[workspaceId]/[slug]/security`
- `/workspace/[workspaceId]/[slug]/team`
- `/workspace/[workspaceId]/[slug]/sources`
- `/workspace/[workspaceId]/[slug]/billing`
- `/workspace/[workspaceId]/[slug]/settings`

## 5) Product direction already baked in
- Multi-tenant workspace model
- Member roles: owner, admin, developer, tester, manager, viewer
- Billing foundation: starter, growth, enterprise
- Hybrid ingestion direction: manual upload + source connectors
- S3 archive metadata fields ready for extension
- Audit event model for actions across the workspace

## 6) Recommended next upgrades
- Real invite acceptance flow by email token
- Stripe checkout + billing portal
- S3 object storage for raw logs
- Background workers for source sync jobs
- Full-text search and saved views
- Alert rule execution engine
- AI incident summaries and RCA generation
- Per-workspace custom branding and subdomain routing

## 7) Notes
This is a serious production starter, not a fake static dashboard. Charts and summaries are generated from actual uploaded logs, while the team/source/billing layers are implemented as real SaaS scaffolding you can keep extending.
