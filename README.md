# Kitchen ERP — Enterprise Monorepo Platform

Production-ready, enterprise-grade multi-tenant Kitchen ERP monorepo foundation built with **Next.js 15**, **React 19**, **TypeScript**, **pnpm Workspaces**, **Turborepo**, **Prisma ORM**, and **Supabase PostgreSQL**.

---

## 🏗️ Workspace Structure

```
kitchen-erp/
├── apps/
│   ├── api/             # Express.js REST API Backend
│   ├── admin/           # Next.js 15 Web Admin Application (React 19, TailwindCSS)
│   └── pwa/             # Next.js 15 PWA Mobile Application (React 19, TailwindCSS)
├── packages/
│   ├── api-client/      # Axios HTTP Client with JWT interceptors
│   ├── ui/              # Shared UI Component Library base
│   ├── types/           # Shared DTOs, Interfaces, Enums
│   ├── utils/           # Common helper & math utilities
│   └── config/          # Zod Environment validation & loader
├── prisma/
│   ├── schema.prisma    # Single workspace PostgreSQL schema
│   ├── migrations/      # Database migrations
│   └── seed.ts          # Database seed script
├── docs/
│   ├── api/             # API contracts & spec documentation
│   ├── architecture/    # Architectural guidelines & patterns
│   ├── deployment/      # Deployment & CI/CD guides
│   └── database/        # Database schema & Supabase specs
├── scripts/             # Workspace operational scripts
├── .github/
│   └── workflows/ci.yml # Monorepo CI Pipeline (GitHub Actions)
├── .env                 # Root shared environment variables
├── .env.example         # Root environment template
├── package.json         # Workspace package configuration
├── pnpm-workspace.yaml  # pnpm workspace definition
├── turbo.json           # Turborepo task pipeline configuration
└── tsconfig.base.json   # Base TypeScript configuration & path aliases
```

---

## 🏛️ System Architecture

```
[ Admin App (Next.js 15) ]    [ PWA App (Next.js 15) ]
            │                            │
            └─────────────┬──────────────┘
                          │ HTTP REST API (Axios + JWT)
                          ▼
                  [ REST API (Express) ]
                          │
                          │ Prisma ORM
                          ▼
            [ Supabase PostgreSQL Database ]
```

- **Separation of Concerns**: Frontend applications (`apps/admin`, `apps/pwa`) interact exclusively with `apps/api` via REST requests using `@kitchen-erp/api-client`.
- **Database Security**: Admin and PWA applications MUST NEVER hold database credentials or directly connect to PostgreSQL. Only `apps/api` communicates directly with Prisma ORM.

---

## 🌐 Multi-Tenant Routing Architecture

The platform supports both **Path-Based Tenant Routing** (`/t/{tenantSlug}`) and **Subdomain-Based Tenant Routing** (`{tenantSlug}.kitchenerp.com`) via a single centralized `TenantResolver` helper in `@kitchen-erp/utils`.

### URL Structure

| Environment    | Admin Portal                                 | API Base URL                         | PWA Mobile Portal                            |
| :------------- | :------------------------------------------- | :----------------------------------- | :------------------------------------------- |
| **Localhost**  | `http://localhost:3001/login`                | `http://localhost:4000`              | `http://localhost:3002/t/badri`              |
| **Production** | `https://kitchen-erp-admin.vercel.app/login` | `https://kitchen-erp-api.vercel.app` | `https://kitchen-erp-pwa.vercel.app/t/badri` |

### Dynamic PWA Screens

All mobile tenant screens reside under `/t/[tenantSlug]`:

- Login: `/t/[tenantSlug]/login`
- Dashboard: `/t/[tenantSlug]`
- Purchases: `/t/[tenantSlug]/purchase`
- History: `/t/[tenantSlug]/history`
- Profile: `/t/[tenantSlug]/profile`
- Settings: `/t/[tenantSlug]/settings`

### 🔮 Future Wildcard Subdomain Migration Plan

When switching to wildcard subdomains (`badri.kitchenerp.com`):

1. Change **one environment variable**: `TENANT_MODE=subdomain` in `.env`.
2. No authentication or route logic changes are required anywhere in the codebase. The central `TenantResolver` automatically handles hostname extraction.

---

## ⚡ How to Install

### Prerequisites

- Node.js `>= 20.0.0`
- pnpm `>= 9.0.0`

### Installation Steps

```bash
# Clone the repository
git clone <repository-url>
cd kitchen-erp

# Install all workspace dependencies using pnpm
pnpm install
```

---

## ⚙️ How to Configure

1. Copy the root environment template:

   ```bash
   cp .env.example .env
   ```

2. Populate root `.env` with Supabase PostgreSQL connection strings and secrets:

   ```env
   DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:6543/postgres?pgbouncer=true"
   DIRECT_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres"
   SUPABASE_URL="https://[YOUR_SUPABASE_PROJECT_REF].supabase.co"
   SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
   SUPABASE_STORAGE_BUCKET="kitchen-erp-invoices"
   JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
   APP_DOMAIN="localhost"
   ```

3. App-specific environment variables are located in local `.env.local` files:
   - `apps/api/.env.local`: `PORT=4000`, `LOG_LEVEL=info`
   - `apps/admin/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000/api`
   - `apps/pwa/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000/api`

---

## 🐘 How Supabase & Prisma Work

- **Supabase PostgreSQL & Storage**: Supabase acts as both our hosted PostgreSQL database and private file storage provider.
  - **Supabase Storage**: Private bucket (`kitchen-erp-invoices`) handles encrypted, tenant-isolated invoice file attachments with short-lived signed URLs.
  - **Storage Provider Abstraction**: A modular `StorageProvider` interface keeps business logic storage-agnostic.
- **Single Prisma Schema**: All database models belong to `packages/database/prisma/schema.prisma`.
- **Single Prisma Schema**: All database models belong to `prisma/schema.prisma`.
- **Dual-Connection Configuration**:
  - `DATABASE_URL`: Connection pooler (Port 6543) for runtime query execution.
  - `DIRECT_URL`: Direct connection (Port 5432) for Prisma CLI migrations and schema pushes.

### Database Commands

```bash
# Generate Prisma Client
pnpm db:generate

# Run development migrations
pnpm db:migrate

# Seed database
pnpm db:seed

# Open Prisma Studio GUI
pnpm db:studio
```

---

## 🚀 Development Workflow & Commands

```bash
# Run all applications and workspace packages in development mode
pnpm dev

# Run build across all workspaces
pnpm build

# Perform strict TypeScript typechecking across monorepo
pnpm typecheck

# Run linting across monorepo
pnpm lint

# Format codebase using Prettier
pnpm format
```

---

## 🧪 Code Quality & Git Hooks

- **ESLint & Prettier**: Automated code style formatting and linting.
- **Husky & lint-staged**: Pre-commit hook runs `prettier` on staged files.
- **Commitlint**: Enforces Conventional Commits specification (`feat:`, `fix:`, `chore:`, `docs:`, etc.).
