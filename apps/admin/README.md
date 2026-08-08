# Kitchen ERP — Admin Application (`apps/admin`)

Next.js 15, React 19 web application for Super Admins and Tenant Administrators.

> [!IMPORTANT]
> Admin application communicates solely with `apps/api` via REST HTTP API using `@kitchen-erp/api-client`. It NEVER connects directly to PostgreSQL or contains database secrets.

## Environment Setup

Environment variables are defined in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_NAME=Kitchen ERP
```

## Development Commands

```bash
# Start admin dev server on port 3000
pnpm --filter @kitchen-erp/admin dev

# Build production bundle
pnpm --filter @kitchen-erp/admin build

# Type check
pnpm --filter @kitchen-erp/admin typecheck
```
