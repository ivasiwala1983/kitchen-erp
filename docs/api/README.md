# API Specifications & Contracts (`docs/api`)

This directory contains specifications and REST API contracts for the Kitchen ERP backend services.

## Overview Architecture

- **Base Endpoint**: `http://localhost:4000/api`
- **Authentication**: JWT Bearer Tokens (`Authorization: Bearer <token>`)
- **Tenant Context**: Multi-tenancy resolved via subdomain (`tenant.kitchenerp.com`) or header (`X-Tenant-Slug`).

## Sub-modules

- `/auth`: Login, refresh tokens, profile management.
- `/tenants`: Super admin tenant onboarding and plan management.
- `/users`: Tenant user management.
- `/categories`: Consolidated master category management.
- `/vendors`: Vendor/supplier directory.
- `/products`: Inventory catalog items.
- `/purchases`: Procurement records and invoice attachments.
- `/reports`: Aggregated analytics and reporting endpoints.
