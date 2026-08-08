# Architecture Overview (`docs/architecture`)

## Monorepo Layout

```
kitchen-erp/
├── apps/
│   ├── api/       # Express REST API Backend
│   ├── admin/     # Next.js 15 Admin Web Application
│   └── pwa/       # Next.js 15 Mobile/Staff PWA Application
├── packages/
│   ├── config/    # Shared Zod Environment & Config Loader
│   ├── types/     # Shared DTOs, Enums, and Interfaces
│   ├── utils/     # Common Utility & Math Helpers
│   ├── api-client/# Axios Client & JWT Interceptor Layer
│   └── ui/        # Shared Component Library Base
├── prisma/        # Single Workspace Database Schema & Seed
├── docs/          # Architecture & Operational Documentation
└── scripts/       # Operational scripts
```

## Security & Separation of Concerns

- **Client Applications (`apps/admin`, `apps/pwa`)** communicate strictly via HTTP REST API (`@kitchen-erp/api-client`). They MUST NEVER connect directly to PostgreSQL or hold database credentials.
- **Backend API (`apps/api`)** is the sole consumer of the Prisma Client and database connection parameters (`DATABASE_URL`).
