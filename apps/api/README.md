# Kitchen ERP — REST API Service (`apps/api`)

Backend API service built with Express, TypeScript, and Prisma ORM connecting to Supabase PostgreSQL.

## Environment Setup

Environment variables are configured in `.env.local` for service specific settings:

```env
PORT=4000
LOG_LEVEL=info
```

Shared database connection string (`DATABASE_URL`), direct URL (`DIRECT_URL`), and `JWT_SECRET` are read from the root `.env` file via `@kitchen-erp/config`.

## Development Commands

```bash
# Start API development server with watch mode
pnpm --filter @kitchen-erp/api dev

# Build for production
pnpm --filter @kitchen-erp/api build

# Type check
pnpm --filter @kitchen-erp/api typecheck
```
