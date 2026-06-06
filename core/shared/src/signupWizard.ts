/** Shared signup wizard rules — same payloads mobile + customer-web send to POST /auth/signup. */

export type SignupFlow = "GUEST" | "BUSINESS";
export type AllowedCountry = "Sweden" | "Norway" | "Denmark" | "Finland";
export type EstablishmentBizType = "Restaurant" | "Cafe" | "Bakery" | "Other";

export const MIN_WIZARD_PHONE_LEN = 6;
export const GUEST_TOTAL_STEPS = 4;
export const BUSINESS_TOTAL_STEPS = 9;

export const ESTABLISHMENT_TYPES: readonly EstablishmentBizType[] = [
  "Restaurant",
  "Cafe",
  "Bakery",
  "Other"
];

export const NORDIC_COUNTRIES: readonly AllowedCountry[] = [
  "Sweden",
  "Norway",
  "Denmark",
  "Finland"
];

export const CITIES: ReadonlyArray<{ country: AllowedCountry; name: string }> = [
  { country: "Sweden", name: "Stockholm" },
  { country: "Sweden", name: "Gothenburg" },
  { country: "Sweden", name: "Malmö" },
  { country: "Sweden", name: "Uppsala" },
  { country: "Sweden", name: "Västerås" },
  { country: "Norway", name: "Oslo" },
  { country: "Norway", name: "Bergen" },
  { country: "Norway", name: "Trondheim" },
  { country: "Norway", name: "Stavanger" },
  { country: "Denmark", name: "Copenhagen" },
  { country: "Denmark", name: "Aarhus" },
  { country: "Denmark", name: "Odense" },
  { country: "Denmark", name: "Aalborg" },
  { country: "Finland", name: "Helsinki" },
  { country: "Finland", name: "Espoo" },
  { country: "Finland", name: "Tampere" },
  { country: "Finland", name: "Turku" }
];

export type WizardSignupPayload = {
  email: string;
  password: string;
  role: "CUSTOMER" | "OWNER";
  phone?: string;
  registrationProfile: Record<string, unknown>;
};

export type SignupFormState = {
  email: string;
  password: string;
  password2: string;
  guestFirst: string;
  guestLast: string;
  guestPhone: string;
  guestLanguage: "EN" | "SV";
  guestCity: string;
  guestCountry: AllowedCountry;
  guestOffers: boolean;
  bizOrgNumber: string;
  bizName: string;
  bizContact: string;
  bizPhone: string;
  bizCountry: AllowedCountry;
  bizCity: string;
  bizAddress: string;
  bizType: EstablishmentBizType;
  bizVenueTradingName: string;
  bizTypeOtherDescribe: string;
  bizEstablishmentLocation: string;
  bizOfferingsDescription: string;
  bizLocations: string;
  bizMonthlyOrders: string;
  bizNeedBookings: boolean;
  bizNeedDelivery: boolean;
  bizCurrentSystem: string;
  bizAcceptTerms: boolean;
  bizAuthorized: boolean;
  bizCompanyFieldsLocked: boolean;
  bizPostalLocked: string;
  bizLegalFormLocked: string;
  bizRegStatusLocked: string;
};

export function establishmentKindLabel(kind: EstablishmentBizType): string {
  switch (kind) {
    case "Restaurant":
      return "Restaurant";
    case "Cafe":
      return "Café";
    case "Bakery":
      return "Bakery";
    case "Other":
      return "Business";
    default:
      return "Business";
  }
}

export function normalizeCityFromRegistry(country: AllowedCountry, raw: string | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  const canon = CITIES.find((c) => c.country === country && c.name.toLowerCase() === t.toLowerCase());
  if (canon) return canon.name;
  return t
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function citiesForCountry(country: AllowedCountry): string[] {
  return CITIES.filter((c) => c.country === country).map((c) => c.name);
}

function isValidEmail(t: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function strongPasswordIssue(p: string): string | null {
  const t = p ?? "";
  if (t.length < 8) return "At least 8 characters";
  if (!/[a-z]/.test(t)) return "Add a lowercase letter";
  if (!/[A-Z]/.test(t)) return "Add an uppercase letter";
  if (!/\d/.test(t)) return "Add a number";
  return null;
}

export function guestWizardStepValidation(
  stepIndex: number,
  form: SignupFormState
): { missing: string[]; msg: string | null } {
  const emailT = form.email.trim();
  const missing: string[] = [];
  let msg: string | null = null;

  if (stepIndex === 0) {
    if (!form.guestFirst.trim()) missing.push("guestFirst");
    if (!form.guestLast.trim()) missing.push("guestLast");
    if (!emailT) missing.push("guestEmail");
    else if (!isValidEmail(emailT)) {
      missing.push("guestEmail");
      msg = "Enter a valid email";
    }
    const ph = form.guestPhone.trim();
    if (!ph) missing.push("guestPhone");
    else if (ph.length < MIN_WIZARD_PHONE_LEN) {
      missing.push("guestPhone");
      msg = msg ?? `Phone needs at least ${MIN_WIZARD_PHONE_LEN} characters`;
    }
    return { missing, msg };
  }
  if (stepIndex === 1) {
    const issue = strongPasswordIssue(form.password);
    if (issue) {
      missing.push("guestPassword");
      msg = issue;
    }
    if (!form.password2.trim()) {
      missing.push("guestPassword2");
      if (!msg) msg = "Confirm your password";
    } else if (form.password !== form.password2) {
      missing.push("guestPassword2");
      msg = "Passwords do not match";
    }
    return { missing, msg };
  }
  if (stepIndex === 2) {
    if (!form.guestCity.trim()) {
      missing.push("guestCity");
      msg = "Select city";
    }
    return { missing, msg };
  }
  return { missing: [], msg: null };
}

export function businessWizardStepValidation(
  stepIndex: number,
  form: SignupFormState
): { missing: string[]; msg: string | null } {
  const emailT = form.email.trim();
  const missing: string[] = [];
  let msg: string | null = null;
  const intOk = (v: string) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && Number.isInteger(n);
  };

  if (stepIndex === 1) {
    if (!form.bizName.trim()) missing.push("bizName");
    if (!form.bizContact.trim()) missing.push("bizContact");
    if (!emailT) missing.push("bizEmail");
    else if (!isValidEmail(emailT)) {
      missing.push("bizEmail");
      msg = "Enter a valid email";
    }
    const ph = form.bizPhone.trim();
    if (!ph) missing.push("bizPhone");
    else if (ph.length < MIN_WIZARD_PHONE_LEN) {
      missing.push("bizPhone");
      msg = msg ?? `Phone needs at least ${MIN_WIZARD_PHONE_LEN} characters`;
    }
    return { missing, msg };
  }
  if (stepIndex === 2) {
    if (!form.bizCity.trim()) {
      missing.push("bizCity");
      msg = "Select city";
    }
    if (!form.bizLocations.trim() || !intOk(form.bizLocations.trim())) {
      missing.push("bizLocations");
      if (!msg) msg = "Enter locations";
    }
    return { missing, msg };
  }
  if (stepIndex === 3) {
    if (!form.bizCompanyFieldsLocked && !form.bizAddress.trim()) missing.push("bizAddress");
    return { missing, msg };
  }
  if (stepIndex === 4) {
    if (!ESTABLISHMENT_TYPES.includes(form.bizType)) {
      missing.push("bizType");
      msg = "Choose establishment type";
    }
    return { missing, msg };
  }
  if (stepIndex === 5) {
    if (!form.bizVenueTradingName.trim() || form.bizVenueTradingName.trim().length < 2) {
      missing.push("bizVenueTradingName");
      if (!msg) msg = `Enter ${establishmentKindLabel(form.bizType).toLowerCase()} name`;
    }
    if (form.bizType === "Other" && !form.bizTypeOtherDescribe.trim()) {
      missing.push("bizTypeOtherDescribe");
      msg = "Describe what type of venue this is";
    }
    if (!form.bizEstablishmentLocation.trim() || form.bizEstablishmentLocation.trim().length < 2) {
      missing.push("bizEstablishmentLocation");
      if (!msg) msg = "Enter physical location";
    }
    if (!form.bizOfferingsDescription.trim() || form.bizOfferingsDescription.trim().length < 2) {
      missing.push("bizOfferingsDescription");
      if (!msg) msg = "Describe what you serve or provide";
    }
    return { missing, msg };
  }
  if (stepIndex === 6) {
    if (!form.bizMonthlyOrders.trim() || !intOk(form.bizMonthlyOrders.trim())) {
      missing.push("bizMonthlyOrders");
      if (!msg) msg = "Enter monthly orders";
    }
    if (!form.bizCurrentSystem.trim()) missing.push("bizCurrentSystem");
    return { missing, msg };
  }
  if (stepIndex === 7) {
    const issue = strongPasswordIssue(form.password);
    if (issue) {
      missing.push("bizPassword");
      msg = issue;
    }
    if (!form.password2.trim()) missing.push("bizPassword2");
    else if (form.password !== form.password2) {
      missing.push("bizPassword2");
      msg = "Passwords do not match";
    }
    if (!form.bizAcceptTerms) missing.push("bizAcceptTerms");
    if (!form.bizAuthorized) missing.push("bizAuthorized");
    return { missing, msg };
  }
  return { missing: [], msg: null };
}

export function evaluateGuestSignupForFinish(
  form: SignupFormState
):
  | { ok: true; payload: WizardSignupPayload }
  | { ok: false; stepIndex: number; message: string; missing: string[] } {
  for (let s = 0; s <= 2; s++) {
    const b = guestWizardStepValidation(s, form);
    if (b.missing.length > 0) {
      return { ok: false, stepIndex: s, message: b.msg ?? "Fill required fields", missing: b.missing };
    }
  }
  return {
    ok: true,
    payload: {
      email: form.email.trim(),
      password: form.password,
      role: "CUSTOMER",
      phone: form.guestPhone.trim(),
      registrationProfile: {
        wizardVersion: 1,
        flow: "GUEST",
        firstName: form.guestFirst.trim(),
        lastName: form.guestLast.trim(),
        phone: form.guestPhone.trim(),
        language: form.guestLanguage,
        city: normalizeCityFromRegistry(form.guestCountry, form.guestCity),
        country: form.guestCountry,
        offersConsent: form.guestOffers
      }
    }
  };
}

export function evaluateBusinessSignupForFinish(
  form: SignupFormState
):
  | { ok: true; payload: WizardSignupPayload }
  | { ok: false; stepIndex: number; message: string; missing: string[] } {
  for (let s = 1; s <= 7; s++) {
    const b = businessWizardStepValidation(s, form);
    if (b.missing.length > 0) {
      return { ok: false, stepIndex: s, message: b.msg ?? "Fill required fields", missing: b.missing };
    }
  }
  return {
    ok: true,
    payload: {
      email: form.email.trim(),
      password: form.password,
      role: "OWNER",
      phone: form.bizPhone.trim(),
      registrationProfile: {
        wizardVersion: 1,
        flow: "BUSINESS",
        orgNumber: form.bizOrgNumber.trim(),
        companyName: form.bizName.trim(),
        contactPerson: form.bizContact.trim(),
        phone: form.bizPhone.trim(),
        country: form.bizCountry,
        city: normalizeCityFromRegistry(form.bizCountry, form.bizCity),
        address: form.bizAddress.trim(),
        locationsCount: form.bizLocations.trim(),
        businessType: form.bizType,
        venueTradingName: form.bizVenueTradingName.trim(),
        businessTypeOtherDescription:
          form.bizType === "Other" ? form.bizTypeOtherDescribe.trim() : undefined,
        establishmentLocation: form.bizEstablishmentLocation.trim(),
        offeringsDescription: form.bizOfferingsDescription.trim(),
        monthlyOrdersEstimate: form.bizMonthlyOrders.trim(),
        wantsBookings: form.bizNeedBookings,
        wantsDelivery: form.bizNeedDelivery,
        currentSystem: form.bizCurrentSystem.trim(),
        postalCodeFromRegistry: form.bizPostalLocked || undefined,
        legalFormFromRegistry: form.bizLegalFormLocked || undefined,
        registrationStatusFromRegistry: form.bizRegStatusLocked || undefined,
        companyLookupLocked: form.bizCompanyFieldsLocked
      }
    }
  };
}

export function createInitialSignupForm(): SignupFormState {
  return {
    email: "",
    password: "",
    password2: "",
    guestFirst: "",
    guestLast: "",
    guestPhone: "",
    guestLanguage: "EN",
    guestCity: "",
    guestCountry: "Sweden",
    guestOffers: true,
    bizOrgNumber: "",
    bizName: "",
    bizContact: "",
    bizPhone: "",
    bizCountry: "Sweden",
    bizCity: "",
    bizAddress: "",
    bizType: "Restaurant",
    bizVenueTradingName: "",
    bizTypeOtherDescribe: "",
    bizEstablishmentLocation: "",
    bizOfferingsDescription: "",
    bizLocations: "1",
    bizMonthlyOrders: "",
    bizNeedBookings: true,
    bizNeedDelivery: true,
    bizCurrentSystem: "",
    bizAcceptTerms: false,
    bizAuthorized: false,
    bizCompanyFieldsLocked: false,
    bizPostalLocked: "",
    bizLegalFormLocked: "",
    bizRegStatusLocked: ""
  };
}

export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  user_already_exists: "An account with this email or phone already exists.",
  email_or_phone_required: "Email or phone is required.",
  sign_up_failed: "Could not create your account. Try again.",
  invalid_registration_profile:
    "Signup data was rejected. Complete all business steps and try again."
};

export function readableAuthFailure(message: string): string {
  const mapped = AUTH_ERROR_MESSAGES[message];
  if (mapped) return mapped;
  const m = message.trim();
  if (/reach the API|reach the server|Network request failed|timed out|timeout|ECONNREFUSED|Failed to fetch|network/i.test(m)) {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return message;
}
