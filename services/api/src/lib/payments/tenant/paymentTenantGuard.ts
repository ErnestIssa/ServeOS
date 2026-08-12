/**
 * Tenant isolation helpers for payment resources.
 */

export function assertSameRestaurant(
  expectedRestaurantId: string,
  actualRestaurantId: string | null | undefined,
  resource = "payment_resource"
) {
  if (!actualRestaurantId || actualRestaurantId !== expectedRestaurantId) {
    throw Object.assign(new Error("cross_tenant_denied"), {
      statusCode: 403,
      code: "cross_tenant_denied",
      resource
    });
  }
}

export function assertClientIdsNotTrusted(input: {
  clientRestaurantId?: string | null;
  resolvedRestaurantId: string;
}) {
  if (input.clientRestaurantId && input.clientRestaurantId !== input.resolvedRestaurantId) {
    throw Object.assign(new Error("cross_tenant_denied"), {
      statusCode: 403,
      code: "cross_tenant_denied",
      resource: "client_restaurant_id"
    });
  }
}
