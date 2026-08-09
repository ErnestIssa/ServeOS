# ServeOS Self-Service Kiosk

**Status:** Scaffold only — not a shipping UI yet.

## Experience

Large touchscreen in the restaurant:

- Browse menu → cart → place order → pay (venue policy)
- Same Menu / Cart / Order Engine as QR and mobile
- Order source: kiosk (backend contract reserved; UI not implemented)

## Product phase

Phase 3 / Future in `docs/fullSaaSProductDetails.md`.

## Related today

- Guest QR ordering in `customer-web` (closest living cousin)
- Future order source `KIOSK_ORDER` (not implemented end-to-end)

## Build later against

- Ordering session + payment policy SSOT
- Locked kiosk device mode (no guest escaping into admin)
- Optional staff assist handoff → `apps/quick-checkout`

See `docs/productExperiences.md`.
