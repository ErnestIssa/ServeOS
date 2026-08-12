/** Operational Communication Layer — realtime fan-out (backend SSOT). */

export type OclEntityType = "order" | "reservation";

export type OclUpdatedPayload = {
  type: "ocl_updated";
  entityType: OclEntityType;
  entityId: string;
  restaurantId: string;
  orderId?: string;
  reservationId?: string;
};

export function roomOclEntity(entityType: OclEntityType, entityId: string) {
  return `ocl:${entityType}:${entityId}`;
}
