# ObserveX SaaS

ObserveX is a production-ready SaaS starter for log intelligence and observability teams.

## Included
- Premium landing page
- Login / create account flow
- Cookie-based JWT authentication
- Workspace-aware SaaS URL structure
- Drag & drop log upload
- Parsing for plain text logs, JSON lines, and JSON arrays
- Visual dashboards generated from uploaded log data
- Alert overview, environment health, application distribution, latency insights
- PostgreSQL + Prisma
- Railway-friendly deployment

## Tech Stack
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

## 4) Default flow
- `/` → landing page
- `/login` → sign in
- `/create-account` → register
- `/workspace/[workspaceId]/[slug]/overview` → dashboard
- `/workspace/[workspaceId]/[slug]/upload` → upload logs

## 5) Supported sample log formats
### Plain text
```txt
2026-04-22 11:20:42 [ERROR] [payment-engine] [Production] trace=TRC-98A21F latency=1821 message="Beneficiary validation failed"
```

### JSON line
```json
{"timestamp":"2026-04-22T11:20:42Z","level":"ERROR","application":"payment-engine","environment":"Production","traceId":"TRC-98A21F","latencyMs":1821,"message":"Beneficiary validation failed"}
```

### JSON array
```json
[
  {"timestamp":"2026-04-22T11:20:42Z","level":"ERROR","application":"payment-engine","environment":"Production","traceId":"TRC-98A21F","latencyMs":1821,"message":"Beneficiary validation failed"}
]
```

## 6) Notes
This is a serious production starter, not a fake static dashboard. Charts and summaries are generated from actual uploaded logs.
