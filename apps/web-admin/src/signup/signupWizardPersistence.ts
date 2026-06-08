import {
  BIZ_CATEGORY_PRESETS,
  BIZ_LOCATION_BANDS,
  BIZ_TEAM_SETUP_OPTIONS,
  createInitialSignupForm,
  type SignupFlow,
  type SignupFormState
} from "@serveos/core-shared/signup-wizard";

const WIZARD_KEY = "serveos.signup.wizard.v2";
const PHASE_KEY = "serveos.signup.phase.v1";

export type SignupPhase = "intro" | "wizard" | "success";

const VALID_TEAM = new Set<string>(BIZ_TEAM_SETUP_OPTIONS.map((o) => o.value));
const VALID_LOCATIONS = new Set<string>(BIZ_LOCATION_BANDS.map((b) => b.value));
const VALID_CATEGORY = new Set([
  ...BIZ_CATEGORY_PRESETS.map((p) => p.value),
  "other"
]);

export function sanitizeSignupForm(raw: Partial<SignupFormState> | undefined): SignupFormState {
  const base = createInitialSignupForm();
  if (!raw || typeof raw !== "object") return base;

  const merged = { ...base, ...raw };

  if (!VALID_TEAM.has(merged.bizStaffCount)) {
    merged.bizStaffCount = "";
  }

  if (merged.bizLocations && !VALID_LOCATIONS.has(merged.bizLocations)) {
    merged.bizLocations = "";
  }

  if (merged.bizBusinessCategory && !VALID_CATEGORY.has(merged.bizBusinessCategory)) {
    merged.bizBusinessCategory = "";
  }

  if (merged.bizBusinessCategory === "other" && !merged.bizTypeOtherDescribe.trim()) {
    merged.bizBusinessCategory = "";
  }

  return merged;
}

export function loadSignupPhase(): SignupPhase {
  try {
    const value = sessionStorage.getItem(PHASE_KEY);
    if (value === "intro" || value === "wizard" || value === "success") return value;
  } catch {
    /* ignore quota / privacy mode */
  }
  return "intro";
}

export function saveSignupPhase(phase: SignupPhase) {
  try {
    sessionStorage.setItem(PHASE_KEY, phase);
  } catch {
    /* ignore */
  }
}

export function clearSignupWizardState() {
  try {
    sessionStorage.removeItem(WIZARD_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSignupSession() {
  try {
    sessionStorage.removeItem(WIZARD_KEY);
    sessionStorage.removeItem(PHASE_KEY);
  } catch {
    /* ignore */
  }
}

type PersistedWizard = {
  flow: SignupFlow;
  step: number;
  form: Partial<SignupFormState>;
};

export function loadWizardState(flow: SignupFlow): { step: number; form: SignupFormState } | null {
  try {
    const raw = sessionStorage.getItem(WIZARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedWizard;
    if (parsed.flow !== flow) return null;
    return {
      step: typeof parsed.step === "number" && parsed.step >= 0 ? parsed.step : 0,
      form: sanitizeSignupForm(parsed.form)
    };
  } catch {
    return null;
  }
}

export function saveWizardState(flow: SignupFlow, step: number, form: SignupFormState) {
  try {
    sessionStorage.setItem(WIZARD_KEY, JSON.stringify({ flow, step, form: sanitizeSignupForm(form) }));
  } catch {
    /* ignore */
  }
}
