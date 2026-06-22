export {
  type OrderOwnershipType,
  type OrderOwnershipSnapshot,
  type OrderOwnershipActor,
  ORDER_OWNERSHIP_IMMUTABILITY
} from "./orderOwnershipTypes.js";

export {
  deriveGuestKey,
  resolveOwnershipType,
  ORDER_OWNERSHIP_RULES
} from "./orderOwnershipPolicy.js";

export {
  captureOrderOwnership,
  getOrderOwnership,
  mapOwnershipRecord,
  type CaptureOwnershipInput
} from "./orderOwnershipCapture.js";

export {
  assertOrderOwnershipAccess,
  canActorViewOrder,
  ORDER_OWNERSHIP_PERMISSION_MATRIX,
  type OwnershipPermission
} from "./orderOwnershipPermissions.js";

export {
  listOrdersByCustomerOwnership,
  listOrdersByGuestKey,
  listOrdersByAssignedStaff,
  listOrdersByReservation,
  listOrdersByDevice
} from "./orderOwnershipResolver.js";
