# ServeOS — Mobile-First Restaurant Operating System

ServeOS is a mobile-first, multi-tenant restaurant operating system with:

- Mobile app(s) for owners/staff/customers
- Web admin dashboard for setup + deep configuration
- Real-time order + kitchen workflows
- Reservations + table management
- Payments + notifications

## Monorepo layout

```
apps/       Mobile + web clients
services/   Backend services (API gateway + domain services)
core/       Shared backend building blocks (DB, events, config, shared)
infra/      Docker, routing, deployment
packages/   Shared TS packages (ui/types/utils)
docs/       Architecture + API docs
```

## Quick start (scaffold)

This repository is currently a foundation scaffold. Next steps typically include:

- choose backend runtime (Node/Nest/Fastify) and database (Postgres)
- add Prisma schema in `core/database`
- add shared types in `packages/types`
- implement auth + gateway in `services/auth-service` and `services/api-gateway`

