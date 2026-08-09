# ServeOS Quick Checkout (staff order entry)

**Status:** Scaffold only — not a shipping UI yet.

## Experience

Counter / side POS for staff when a guest does **not** use the kiosk or mobile app:

- Fast item pick → modifiers → create staff/walk-in order
- Cashier / manager quick actions (role-limited)
- Pay-at-venue or online capture per venue payment policy

Companion to `apps/kiosk`, not a replacement for full venue admin.

## Product phase

Phase 3 / Future (“Quick Checkout Screen”) in `docs/fullSaaSProductDetails.md`.

## Related today

- Roles `CASHIER` / `STAFF` / `MANAGER` in staff access
- Mobile checkout queue (list-oriented, not full counter POS)
- Order sources such as staff-created / walk-in (contracts evolving)

## Build later against

- Staff auth + permission gates (backend SSOT)
- Order Engine create path for `STAFF_CREATED` / walk-in
- Optional desktop vs tablet capability matrix for counter devices

See `docs/productExperiences.md`.
