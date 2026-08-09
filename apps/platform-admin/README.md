# ServeOS Platform Admin (internal)

**Status:** Scaffold only — not a shipping UI yet.

## Experience

**Internal ServeOS operator console** — for the people who run the ServeOS product, **not** a restaurant.

Examples of eventual scope:

- Tenant / restaurant directory & suspension
- Plan / subscription overrides (platform billing)
- Abuse, fraud, and support escalation tools
- Global feature flags / kill switches
- Platform health, jobs, and webhook ops visibility

## Hard boundary

| Surface | Audience |
|---------|----------|
| `customer-web` `/admin` | Restaurant owners/managers |
| `apps/platform-admin` | ServeOS employees / platform ops |

Do **not** mix venue guest-payment config with ServeOS SaaS billing here without clear domains.

## Related today

- No dedicated platform-admin app existed before this scaffold
- Venue billing UI is restaurant-facing ServeOS subscription management inside venue admin

See `docs/productExperiences.md`.
