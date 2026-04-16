# Architecture

## Goals

- Mobile-first operations for owners/staff/customers
- Web admin for configuration + deep management
- Real-time order + kitchen updates
- Multi-tenant SaaS (data isolation per restaurant)

## High-level structure

- `apps/`: clients (mobile + web)
- `services/`: backend services
- `core/`: shared backend building blocks (DB, events, config, shared)
- `packages/`: shared TypeScript packages (ui/types/utils)
- `infra/`: Docker + routing + deployment

## Services (planned)

- `services/api-gateway`: single entry point, routing, auth verification, rate limits
- `services/auth-service`: authentication + role/permission model
- `services/restaurant-service`: restaurants, tables, menus, floorplans
- `services/order-service`: orders, KDS workflows, realtime status
- `services/payment-service`: payment providers + reconciliation
- `services/notification-service`: push/email/SMS notifications

