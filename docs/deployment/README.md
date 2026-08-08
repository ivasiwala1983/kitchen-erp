# Deployment Guide (`docs/deployment`)

## Deployment Strategy

- **Applications (`apps/admin`, `apps/pwa`)**: Deployed as SSR/Edge applications (Vercel, Docker container, or Node.js server).
- **REST API (`apps/api`)**: Deployed as Node.js web service (Docker, Railway, AWS ECS, Render).
- **Database**: Supabase PostgreSQL database instance.

## CI/CD Pipeline

GitHub Actions workflow in `.github/workflows/ci.yml` automates:

1. Dependency installation (`pnpm install --frozen-lockfile`)
2. Prisma Client generation (`pnpm db:generate`)
3. Workspace type checking (`pnpm typecheck`)
4. Linting (`pnpm lint`)
5. Monorepo application builds (`pnpm build`)
