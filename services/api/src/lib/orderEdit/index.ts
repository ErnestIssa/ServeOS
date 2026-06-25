export {
  type OrderEditOperationType,
  type OrderEditActor,
  type OrderEditRequest,
  type OrderEditPayload,
  type OrderEditResult,
  type OrderEditWindow,
  type EditWindowLevel,
  type OrderEditPricingResult,
  type OrderEditRequestSource
} from "./orderEditTypes.js";

export { applyOrderEditOperation, ORDER_EDIT_DOMAIN_RULES } from "./orderEditService.js";

export {
  resolveEditWindow,
  validateOrderEdit,
  assertOperationAllowedInWindow,
  ORDER_EDIT_VALIDATION_RULES
} from "./orderEditValidation.js";

export {
  SOURCE_EDIT_RULES,
  resolveSourceEditRules,
  assertSourceEditAllowed,
  ORDER_EDIT_SOURCE_AUTHORITY
} from "./orderEditSourceRules.js";

export {
  assertEditActorPermission,
  isManagerActor,
  isStaffActor,
  ORDER_EDIT_PERMISSION_MATRIX
} from "./orderEditPermissions.js";

export {
  applyEditToLines,
  summarizeLineTotals,
  computePaymentDelta,
  assertEditPaymentSafety,
  resolveNoteAfterEdit
} from "./orderEditPricing.js";

export { recordOrderEditAudit, ORDER_EDIT_AUDIT_CLASSIFICATION } from "./orderEditAudit.js";

export { resolveEditEventTypes, emitOrderEditEvents, ORDER_EDIT_EVENT_AUTHORITY } from "./orderEditEvents.js";
