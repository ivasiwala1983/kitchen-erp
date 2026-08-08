# Kitchen ERP — Multi-Tenant Enterprise Solution

Production-quality, enterprise-grade multi-tenant Kitchen ERP system built from scratch with Next.js, Express, PostgreSQL, Prisma ORM, JWT authentication, and local file storage.

## 🏗 Key Architectural Principles

- **Unified Category Master**: Consolidated single category master (`Category`) referenced directly by both `Vendor` and `Product` tables.
- **Tenant Isolation**: Every database table uses UUID PKs, `tenantId`, audit timestamps (`createdAt`, `updatedAt`, `deletedAt`), and user tracking (`createdBy`, `updatedBy`).
- **Role & Permission Controls**
- **Clean Architecture**
- **Modular Monorepo**

## 📂 Project Structure

```text
kitchen-erp/
├── apps/
│   ├── api/
│   ├── admin/
│   └── pwa/
├── packages/
│   ├── types/
│   ├── utils/
│   ├── api-client/
│   └── ui/
├── prisma/
└── docs/
```

## 🚀 Tech Stack

- Next.js
- React
- TypeScript
- PostgreSQL
- Prisma
- JWT
- SeaweedFS
- Tailwind CSS
- Turborepo
- pnpm

## 📖 Documentation

- API Documentation
- Database Schema
- Setup Guide
