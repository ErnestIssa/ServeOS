import type { CanonicalOrderSource, OrderSourceContract } from "./orderSourceTypes.js";

const baseValidation = {
  requiresRestaurantContext: true,
  requiresMenuLines: true
} as const;

const hybridPrepayPayment = {
  allowStaffLineAdditions: true,
  requiresRepaymentOnLineAddition: true,
  splitPaymentAllowed: false,
  refundRestricted: false,
  chargebackReviewRequired: false
} as const;

const counterPayment = {
  allowStaffLineAdditions: true,
  requiresRepaymentOnLineAddition: false,
  splitPaymentAllowed: true,
  refundRestricted: false,
  chargebackReviewRequired: false
} as const;

const partnerPaymentEvolution = {
  allowStaffLineAdditions: false,
  requiresRepaymentOnLineAddition: false,
  splitPaymentAllowed: false,
  refundRestricted: true,
  chargebackReviewRequired: true
} as const;

/** Phase 1 source contracts — SSOT for source-driven behavior. */
export const ORDER_SOURCE_CONTRACTS: Record<CanonicalOrderSource, OrderSourceContract> = {
  QR_ORDER: {
    source: "QR_ORDER",
    label: "QR / customer web order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: true,
      requiresSourceSession: true,
      requiresTableContext: false,
      requiresStaffCreator: false,
      requiresReservationLink: false,
      requiresPartnerReference: false
    },
    payment: {
      paymentRequiredBeforeAcceptance: true,
      paymentRequiredBeforePreparation: true,
      payLaterAllowed: false,
      externalPaymentOwned: false,
      defaultInitialStatus: "PENDING_PAYMENT",
      ...hybridPrepayPayment
    },
    ownership: {
      defaultCreatedByContext: "CUSTOMER",
      customerAccountOptional: true,
      staffCreatorRequired: false,
      partnerReferenceRequired: false
    },
    notifications: {
      notifyCustomerOnStatus: true,
      notifyStaffOnCreate: true,
      smsAllowed: false,
      partnerCallback: false,
      minimalCustomerNotifications: false
    },
    analytics: {
      channel: "qr_digital",
      conversionTrackable: true,
      revenueBucket: "in_venue_digital"
    }
  },

  WALK_IN: {
    source: "WALK_IN",
    label: "Walk-in counter order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: false,
      requiresSourceSession: false,
      requiresTableContext: false,
      requiresStaffCreator: false,
      requiresReservationLink: false,
      requiresPartnerReference: false
    },
    payment: {
      paymentRequiredBeforeAcceptance: false,
      paymentRequiredBeforePreparation: false,
      payLaterAllowed: true,
      externalPaymentOwned: false,
      defaultInitialStatus: "CREATED",
      ...counterPayment
    },
    ownership: {
      defaultCreatedByContext: "STAFF",
      customerAccountOptional: true,
      staffCreatorRequired: false,
      partnerReferenceRequired: false
    },
    notifications: {
      notifyCustomerOnStatus: false,
      notifyStaffOnCreate: true,
      smsAllowed: false,
      partnerCallback: false,
      minimalCustomerNotifications: true
    },
    analytics: {
      channel: "walk_in",
      conversionTrackable: false,
      revenueBucket: "in_venue_counter"
    }
  },

  STAFF_CREATED: {
    source: "STAFF_CREATED",
    label: "Staff-created order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: false,
      requiresSourceSession: false,
      requiresTableContext: false,
      requiresStaffCreator: true,
      requiresReservationLink: false,
      requiresPartnerReference: false
    },
    payment: {
      paymentRequiredBeforeAcceptance: false,
      paymentRequiredBeforePreparation: false,
      payLaterAllowed: true,
      externalPaymentOwned: false,
      defaultInitialStatus: "CREATED",
      ...counterPayment
    },
    ownership: {
      defaultCreatedByContext: "STAFF",
      customerAccountOptional: true,
      staffCreatorRequired: true,
      partnerReferenceRequired: false
    },
    notifications: {
      notifyCustomerOnStatus: true,
      notifyStaffOnCreate: true,
      smsAllowed: true,
      partnerCallback: false,
      minimalCustomerNotifications: false
    },
    analytics: {
      channel: "staff_pos",
      conversionTrackable: false,
      revenueBucket: "staff_assisted"
    }
  },

  PHONE_ORDER: {
    source: "PHONE_ORDER",
    label: "Phone order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: false,
      requiresSourceSession: false,
      requiresTableContext: false,
      requiresStaffCreator: true,
      requiresReservationLink: false,
      requiresPartnerReference: false
    },
    payment: {
      paymentRequiredBeforeAcceptance: false,
      paymentRequiredBeforePreparation: false,
      payLaterAllowed: true,
      externalPaymentOwned: false,
      defaultInitialStatus: "CREATED",
      ...counterPayment
    },
    ownership: {
      defaultCreatedByContext: "STAFF",
      customerAccountOptional: true,
      staffCreatorRequired: true,
      partnerReferenceRequired: false
    },
    notifications: {
      notifyCustomerOnStatus: true,
      notifyStaffOnCreate: true,
      smsAllowed: true,
      partnerCallback: false,
      minimalCustomerNotifications: false
    },
    analytics: {
      channel: "phone",
      conversionTrackable: false,
      revenueBucket: "staff_assisted"
    }
  },

  RESERVATION_ORDER: {
    source: "RESERVATION_ORDER",
    label: "Reservation-linked order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: false,
      requiresSourceSession: false,
      requiresTableContext: false,
      requiresStaffCreator: false,
      requiresReservationLink: true,
      requiresPartnerReference: false
    },
    payment: {
      paymentRequiredBeforeAcceptance: false,
      paymentRequiredBeforePreparation: false,
      payLaterAllowed: true,
      externalPaymentOwned: false,
      defaultInitialStatus: "CREATED",
      ...counterPayment
    },
    ownership: {
      defaultCreatedByContext: "CUSTOMER",
      customerAccountOptional: true,
      staffCreatorRequired: false,
      partnerReferenceRequired: false
    },
    notifications: {
      notifyCustomerOnStatus: true,
      notifyStaffOnCreate: true,
      smsAllowed: true,
      partnerCallback: false,
      minimalCustomerNotifications: false
    },
    analytics: {
      channel: "reservation",
      conversionTrackable: true,
      revenueBucket: "reservation_dining"
    }
  },

  DELIVERY_PARTNER: {
    source: "DELIVERY_PARTNER",
    label: "Delivery partner order",
    validation: {
      ...baseValidation,
      requiresCustomerOrGuest: false,
      requiresSourceSession: false,
      requiresTableContext: false,
      requiresStaffCreator: false,
      requiresReservationLink: false,
      requiresPartnerReference: true
    },
    payment: {
      paymentRequiredBeforeAcceptance: false,
      paymentRequiredBeforePreparation: false,
      payLaterAllowed: false,
      externalPaymentOwned: true,
      defaultInitialStatus: "PAID",
      ...partnerPaymentEvolution
    },
    ownership: {
      defaultCreatedByContext: "STAFF",
      customerAccountOptional: true,
      staffCreatorRequired: false,
      partnerReferenceRequired: true
    },
    notifications: {
      notifyCustomerOnStatus: false,
      notifyStaffOnCreate: true,
      smsAllowed: false,
      partnerCallback: true,
      minimalCustomerNotifications: true
    },
    analytics: {
      channel: "delivery_partner",
      conversionTrackable: true,
      revenueBucket: "third_party_delivery"
    }
  }
};

export function getSourceContract(source: CanonicalOrderSource): OrderSourceContract {
  return ORDER_SOURCE_CONTRACTS[source];
}
