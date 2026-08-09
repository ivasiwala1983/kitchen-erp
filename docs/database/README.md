# Database Architecture (`docs/database`)

## Supabase PostgreSQL Integration

The Kitchen ERP monorepo utilizes Supabase strictly as a hosted PostgreSQL database.

> [!NOTE]
> Supabase is utilized for PostgreSQL database hosting and private file storage (`kitchen-erp-invoices`). Supabase Auth and Realtime services are not used.

### Prisma Dual-URL Connection Setup

For Supabase connection pooler compatibility:

1. `DATABASE_URL`: Transaction pooler connection URL (Port 6543 / PgBouncer mode) used for application query execution.
2. `DIRECT_URL`: Direct database connection URL (Port 5432) used by Prisma CLI for migrations and DDL schema modifications.

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
