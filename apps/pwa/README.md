# Kitchen ERP — PWA Mobile/Staff Application (`apps/pwa`)

Progressive Web App built with Next.js 15 and React 19 for kitchen staff and inventory managers.

> [!IMPORTANT]
> PWA application communicates solely with `apps/api` via REST HTTP API using `@kitchen-erp/api-client`. It NEVER connects directly to PostgreSQL or contains database credentials.

## Environment Setup

Environment variables are defined in `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_APP_NAME=ArgusOne
```

## Development Commands

```bash
# Start PWA dev server on port 3001
pnpm --filter @kitchen-erp/pwa dev

# Build production bundle
pnpm --filter @kitchen-erp/pwa build

# Type check
pnpm --filter @kitchen-erp/pwa typecheck
```
