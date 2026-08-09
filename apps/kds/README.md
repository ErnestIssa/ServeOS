# ServeOS KDS (Kitchen Display System)

**Status:** Scaffold only — not a shipping UI yet.

## Experience

Always-on kitchen screen (tablet / monitor / touch):

- Incoming orders → preparing → ready
- Ticket actions for kitchen staff
- Optimized for back-of-house speed (not full admin)

## Product phase

Phase 2 in `docs/fullSaaSProductDetails.md`.

## Related today

- Partial kitchen kanban in venue admin (`customer-web` orders)
- Mobile `staff.kitchen_queue`
- Order event projections (`toKdsView` in shared types)
- Hardware kind `kds` in deployment/device config

## Build later against

- Order Engine + realtime events (SSOT)
- Venue device pairing / station assignment
- Role: kitchen / staff with kitchen permissions

See `docs/productExperiences.md`.
