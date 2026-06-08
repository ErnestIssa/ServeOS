import {
  BIZ_CATEGORY_PRESETS,
  BIZ_LOCATION_BANDS,
  BIZ_TEAM_SETUP_OPTIONS,
  GUEST_TOTAL_STEPS,
  NORDIC_COUNTRIES,
  businessCategoryPatch,
  businessWizardStepValidation,
  citiesForCountry,
  companyAddressForVenueCopy,
  createInitialSignupForm,
  venueNameFieldLabel,
  venueStepTitle,
  evaluateBusinessSignupForFinish,
  evaluateGuestSignupForFinish,
  guestWizardStepValidation,
  normalizeCityFromRegistry,
  readableAuthFailure,
  type AllowedCountry,
  type SignupFlow,
  type SignupFormState
} from "@serveos/core-shared/signup-wizard";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authSignup, lookupCompany } from "../api";
import { iconPath } from "../marketing/assetPaths";
import {
  NO_BUSINESS_YET_PATH,
  PRIVACY_POLICY_PATH,
  TERMS_OF_SERVICE_PATH,
  WEB_ADMIN_URL
} from "../marketing/constants";
import { BizOtherTypeModal } from "./BizOtherTypeModal";
import {
  applyCompanyInfoDraft,
  companyInfoDraftFromForm,
  formatCompanyAddress,
  type CompanyInfoDraft
} from "./companyInfoDisplay";
import { ChangeCompanyInfoModal } from "./ChangeCompanyInfoModal";
import { AccountCreationInfoModal } from "./AccountCreationInfoModal";
import { OwnerAccountInfoModal } from "./OwnerAccountInfoModal";
import { InfoIcon } from "./signupIcons";
import { countryPickerLabel } from "./venueCountryDisplay";
import { SignupConfirmModal } from "./SignupConfirmModal";
import { VenueCountryModal } from "./VenueCountryModal";
import { handoffToAdminApp } from "./adminHandoff";
import { clearSignupSession, loadWizardState, saveWizardState } from "./signupWizardPersistence";
import { SignupRegistrationLoader } from "./SignupRegistrationLoader";
import { SignupStepShell, SignupWizardActions } from "./SignupShell";

const WEB_BUSINESS_TOTAL_STEPS = 4;

const REGISTER_ICON = iconPath("register-svgrepo-com.svg");
const COMPANY_ICON = iconPath("company-svgrepo-com.svg");
const VENUE_ICON = iconPath("location-marker-pin-svgrepo-com.svg");
const OWNER_ACCOUNT_ICON = iconPath("user-add-account-profile-svgrepo-com.svg");

const sectionHeading = "font-display text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl";

const choiceBtn =
  "rounded-xl border px-3 py-2.5 text-center text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-violet-200/60";
const choiceBtnOn =
  "border-transparent bg-gradient-to-r from-violet-600 to-blue-600 font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)]";
const choiceBtnOff = "border-slate-200 bg-white/80 text-slate-700 hover:border-violet-200";
const choiceBtnErr = "border-red-300 bg-red-50/50 text-slate-900";
const primaryBtn =
  "rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500";

function EditIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.12l-2.38-2.38a1.5 1.5 0 0 0-2.12 0L4 15.5V20Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="m13.5 6.5 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const inputBase =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60";
const inputErr = "border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-200/60";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";

type Props = {
  flow: SignupFlow;
  onExit: () => void;
  onSuccess: (role: "CUSTOMER" | "OWNER") => void;
  onAccountCreatingChange?: (creating: boolean) => void;
};

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className={labelCls}>{children}</label>;
}

function TextField({
  value,
  onChange,
  placeholder,
  type = "text",
  error,
  disabled,
  autoComplete
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  error?: boolean;
  disabled?: boolean;
  autoComplete?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      disabled={disabled}
      autoComplete={autoComplete}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputBase} ${error ? inputErr : ""} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
    />
  );
}

function PasswordField({
  value,
  onChange,
  placeholder,
  error,
  autoComplete,
  showPassword,
  onToggleShow,
  disableToggle,
  onFocus,
  onBlur
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: boolean;
  autoComplete?: string;
  showPassword: boolean;
  onToggleShow: () => void;
  disableToggle?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  const hidden = disableToggle || !showPassword;

  return (
    <div className="relative">
      <input
        type={hidden ? "password" : "text"}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className={`signup-password-input ${inputBase} pr-11 ${error ? inputErr : ""}`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        disabled={disableToggle}
        aria-label={showPassword ? "Hide password" : "Show password"}
        className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-base leading-none transition ${
          disableToggle ? "cursor-not-allowed opacity-35" : "opacity-80 hover:opacity-100"
        }`}
      >
        {showPassword ? "🙈" : "👁"}
      </button>
    </div>
  );
}

export function SignupWizard({ flow, onExit, onSuccess, onAccountCreatingChange }: Props) {
  const persisted = useMemo(() => loadWizardState(flow), [flow]);
  const [step, setStep] = useState(() => {
    const saved = persisted?.step ?? 0;
    return flow === "BUSINESS" ? Math.min(saved, WEB_BUSINESS_TOTAL_STEPS - 1) : saved;
  });
  const [form, setForm] = useState<SignupFormState>(() => persisted?.form ?? createInitialSignupForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [btnErr, setBtnErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bizLookupBusy, setBizLookupBusy] = useState(false);
  const [bizLookupMsg, setBizLookupMsg] = useState<string | null>(null);
  const [otherTypeModalOpen, setOtherTypeModalOpen] = useState(false);
  const [removeOtherTypeConfirmOpen, setRemoveOtherTypeConfirmOpen] = useState(false);
  const [changeCompanyModalOpen, setChangeCompanyModalOpen] = useState(false);
  const [venueCountryModalOpen, setVenueCountryModalOpen] = useState(false);
  const [bizShowPass, setBizShowPass] = useState(false);
  const [bizShowConfirmPass, setBizShowConfirmPass] = useState(false);
  const [bizConfirmStarted, setBizConfirmStarted] = useState(false);
  const [bizConfirmEditing, setBizConfirmEditing] = useState(false);
  const [bizConfirmMismatch, setBizConfirmMismatch] = useState<string | null>(null);
  const [ownerInfoModalOpen, setOwnerInfoModalOpen] = useState(false);
  const [accountCreationInfoOpen, setAccountCreationInfoOpen] = useState(false);
  const [bizAccountCreating, setBizAccountCreating] = useState(false);
  const [companyModalInitial, setCompanyModalInitial] = useState<CompanyInfoDraft>(() =>
    companyInfoDraftFromForm(createInitialSignupForm())
  );
  const [otherTypeModalSeed, setOtherTypeModalSeed] = useState("");

  const stepRef = useRef(step);
  const formRef = useRef(form);
  stepRef.current = step;
  formRef.current = form;

  const totalSteps = flow === "BUSINESS" ? WEB_BUSINESS_TOTAL_STEPS : GUEST_TOTAL_STEPS;
  const isBusiness = flow === "BUSINESS";

  useEffect(() => {
    saveWizardState(flow, step, form);
  }, [flow, step, form]);

  useEffect(() => {
    onAccountCreatingChange?.(bizAccountCreating);
  }, [bizAccountCreating, onAccountCreatingChange]);

  const patch = useCallback(
    (partial: Partial<SignupFormState>) => {
      setForm((f) => {
        const next = { ...f, ...partial };
        formRef.current = next;
        saveWizardState(flow, stepRef.current, next);
        return next;
      });
      setBannerErr(null);
      setBtnErr(null);
    },
    [flow]
  );

  const markErrors = (keys: string[]) => {
    const next: Record<string, boolean> = {};
    keys.forEach((k) => {
      next[k] = true;
    });
    setFieldErrors(next);
  };

  const fieldErr = (key: string) => Boolean(fieldErrors[key]);

  const clearField = (key: string) => {
    setFieldErrors((m) => {
      if (!m[key]) return m;
      const next = { ...m };
      delete next[key];
      return next;
    });
  };

  const clearOtherBusinessType = () => {
    clearField("bizBusinessCategory");
    clearField("bizTypeOtherDescribe");
    patch({
      bizBusinessCategory: "",
      bizTypeOtherDescribe: "",
      bizType: "Restaurant"
    });
  };

  const runOrgLookup = async () => {
    setBannerErr(null);
    setBtnErr(null);
    setBizLookupMsg(null);
    const t = form.bizOrgNumber.trim();
    if (!t) {
      markErrors(["bizOrgNumber"]);
      setBtnErr("Enter organization number");
      return;
    }
    setBizLookupBusy(true);
    try {
      const res = await lookupCompany(t);
      if (res.success && res.found && res.data?.companyName?.trim()) {
        const cityRaw = res.data.city?.trim();
        if (!cityRaw) {
          setBizLookupMsg("We couldn't find full company records. Try another organization number.");
          setBtnErr("Incomplete registry data");
          markErrors(["bizOrgNumber"]);
          return;
        }
        patch({
          bizName: res.data.companyName.trim(),
          bizAddress: (res.data.address ?? "").trim(),
          bizCity: normalizeCityFromRegistry("Sweden", cityRaw),
          bizCountry: "Sweden",
          bizPostalLocked: (res.data.postalCode ?? "").trim(),
          bizLegalFormLocked: (res.data.legalForm ?? "").trim(),
          bizRegStatusLocked: (res.data.status ?? "").trim(),
          bizCompanyFieldsLocked: true
        });
        clearField("bizOrgNumber");
        setStep(1);
        return;
      }
      setBizLookupMsg("We couldn't find your company.");
      setBtnErr("Company not found");
      markErrors(["bizOrgNumber"]);
    } catch {
      setBizLookupMsg("We couldn't find your company.");
      setBtnErr("Lookup failed");
      markErrors(["bizOrgNumber"]);
    } finally {
      setBizLookupBusy(false);
    }
  };

  const submitSignup = async () => {
    const fin = isBusiness ? evaluateBusinessSignupForFinish(form) : evaluateGuestSignupForFinish(form);
    if (!fin.ok) {
      setStep(fin.stepIndex);
      setBannerErr(fin.message);
      setBtnErr(fin.message);
      markErrors(fin.missing);
      return;
    }
    setBusy(true);
    setBannerErr(null);
    const res = await authSignup(fin.payload);
    setBusy(false);
    if (!res.ok || !res.token) {
      setBannerErr(readableAuthFailure(res.error ?? "sign_up_failed"));
      return;
    }
    sessionStorage.setItem("serveos.signup.token", res.token);
    onSuccess(fin.payload.role);
  };

  const submitBusinessAccount = async () => {
    setBannerErr(null);
    setBtnErr(null);

    const stepValidation = businessWizardStepValidation(3, form);
    if (stepValidation.missing.length > 0) {
      setBtnErr(stepValidation.msg ?? "Fill required fields");
      markErrors(stepValidation.missing);
      return;
    }

    const fin = evaluateBusinessSignupForFinish(form);
    if (!fin.ok) {
      setStep(fin.stepIndex);
      setBannerErr(fin.message);
      setBtnErr(fin.message);
      markErrors(fin.missing);
      return;
    }

    setFieldErrors({});
    setBizAccountCreating(true);

    const res = await authSignup(fin.payload);

    if (!res.ok || !res.token) {
      setBizAccountCreating(false);
      const msg = readableAuthFailure(res.error ?? "sign_up_failed");
      setBannerErr(msg);
      setBtnErr(msg);
      return;
    }

    clearSignupSession();
    handoffToAdminApp(res.token);

    if (!WEB_ADMIN_URL) {
      setBizAccountCreating(false);
      onSuccess("OWNER");
    }
  };

  const goNext = () => {
    setBannerErr(null);
    setBtnErr(null);

    if (isBusiness && step === 3) {
      void submitBusinessAccount();
      return;
    }

    if (step >= totalSteps - 1) {
      void submitSignup();
      return;
    }

    if (isBusiness && step === 0) return;

    if (!isBusiness) {
      const v = guestWizardStepValidation(step, form);
      if (v.missing.length > 0) {
        setBtnErr(v.msg ?? "Fill required fields");
        markErrors(v.missing);
        return;
      }
    } else if (step >= 1 && step <= 3) {
      const v = businessWizardStepValidation(step, form);
      if (v.missing.length > 0) {
        setBtnErr(v.msg ?? "Fill required fields");
        markErrors(v.missing);
        return;
      }
    }

    setFieldErrors({});
    setStep((s) => Math.min(totalSteps - 1, s + 1));
  };

  const goBack = () => {
    setBannerErr(null);
    setBtnErr(null);
    if (step === 0) {
      onExit();
      return;
    }
    const next = step - 1;
    if (isBusiness && next === 0) {
      patch({
        bizCompanyFieldsLocked: false,
        bizPostalLocked: "",
        bizLegalFormLocked: "",
        bizRegStatusLocked: "",
        bizName: "",
        bizAddress: "",
        bizCity: ""
      });
    }
    setStep(next);
  };

  const openChangeCompanyModal = () => {
    setCompanyModalInitial(companyInfoDraftFromForm(form));
    setChangeCompanyModalOpen(true);
  };

  const saveCompanyInfo = (draft: CompanyInfoDraft) => {
    setBannerErr(null);
    setBtnErr(null);
    clearField("bizName");
    patch(applyCompanyInfoDraft(draft));
    setChangeCompanyModalOpen(false);
  };

  const finishLabel = isBusiness ? "Launch Dashboard" : "Start Exploring";

  const guestCities = useMemo(() => citiesForCountry(form.guestCountry), [form.guestCountry]);
  const policyLinkCls =
    "font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2 transition hover:text-violet-900";
  const infoIconBtnCls =
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-200/80 bg-white text-violet-700 align-middle shadow-sm transition hover:border-violet-300 hover:bg-violet-50";

  const wizardFooter = (
    <>
      {isBusiness && step === 3 ? (
        <p className="mb-5 text-center text-xs leading-relaxed text-slate-500">
          By clicking Create account, you agree to the ServeOS{" "}
          <a href={TERMS_OF_SERVICE_PATH} className={policyLinkCls}>
            Terms of Service
          </a>{" "}
          and{" "}
          <a href={PRIVACY_POLICY_PATH} className={policyLinkCls}>
            Privacy Policy
          </a>
          .{" "}
          <button
            type="button"
            onClick={() => setAccountCreationInfoOpen(true)}
            aria-label="What you get with ServeOS account creation"
            className={`${infoIconBtnCls} ml-0.5`}
          >
            <InfoIcon className="h-3.5 w-3.5" />
          </button>
        </p>
      ) : null}
      <SignupWizardActions
        onBack={goBack}
        onContinue={() => (isBusiness && step === 0 ? void runOrgLookup() : goNext())}
        continueLabel={
          isBusiness && step === 0
            ? bizLookupBusy
              ? "Looking up…"
              : "Continue"
            : isBusiness && step === 3
              ? busy
                ? "Creating account…"
                : "Create account"
              : busy
                ? "Creating account…"
                : step >= totalSteps - 1
                  ? finishLabel
                  : "Continue"
        }
        continueBusy={busy || bizLookupBusy}
      />
      {btnErr ? <p className="mt-3 text-center text-sm font-medium text-red-600">{btnErr}</p> : null}
    </>
  );

  const renderBusinessStepBody = () => {
    if (step === 0) {
      return (
        <SignupStepShell
          stepKey={step}
          iconSrc={REGISTER_ICON}
          title="Find your company"
          description={
            <p className="relative mx-auto w-max max-w-full -translate-x-6 whitespace-nowrap text-center text-sm sm:text-base sm:-translate-x-7">
              Enter your organization number and we&apos;ll retrieve your company information to speed up setup.
            </p>
          }
          descriptionClassName="w-full"
          belowForm={
            <a
              href={NO_BUSINESS_YET_PATH}
              className="text-sm font-medium text-violet-700 underline decoration-solid decoration-violet-400 underline-offset-[3px] transition hover:text-violet-900"
            >
              I haven&apos;t started my business yet
            </a>
          }
          footer={wizardFooter}
        >
          <div>
            <FieldLabel>Organization number</FieldLabel>
            <TextField
              value={form.bizOrgNumber}
              onChange={(v) => {
                clearField("bizOrgNumber");
                setBizLookupMsg(null);
                patch({ bizOrgNumber: v });
              }}
              placeholder="556123-4567"
              error={fieldErr("bizOrgNumber")}
            />
            {bizLookupMsg ? <p className="mt-2 text-sm font-medium text-red-600">{bizLookupMsg}</p> : null}
          </div>
        </SignupStepShell>
      );
    }

    if (step === 1) {
      return (
        <SignupStepShell
          stepKey={step}
          iconSrc={COMPANY_ICON}
          title="We found your business"
          description={
            <p className="w-max max-w-none whitespace-nowrap text-sm sm:text-base">
              We&apos;ve connected your company information and are preparing your ServeOS workspace.
            </p>
          }
          descriptionClassName="w-full"
          footer={wizardFooter}
        >
          <div className="space-y-6">
            <dl className="flex w-full flex-wrap items-start justify-between gap-x-6 gap-y-4 text-sm sm:gap-x-10">
              <div className="min-w-0 shrink-0">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Company name</dt>
                <dd className="mt-1 font-semibold text-slate-900">{form.bizName.trim() || "—"}</dd>
              </div>
              <div className="min-w-0 shrink-0">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Address</dt>
                <dd className="mt-1 font-semibold text-slate-900">{formatCompanyAddress(form)}</dd>
              </div>
              <div className="min-w-0 shrink-0">
                <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">Company form</dt>
                <dd className="mt-1 font-semibold text-slate-900">{form.bizLegalFormLocked.trim() || "—"}</dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={openChangeCompanyModal}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-violet-200 hover:text-violet-800"
            >
              <EditIcon />
              Change Information
            </button>

            <div className="space-y-5 border-t border-slate-200/80 pt-6">
              <h2 className={sectionHeading}>Tell Us About Your Business</h2>

              <div>
                <p className="mb-3 text-sm font-semibold text-slate-800">What type of business do you have?</p>

                {form.bizBusinessCategory === "other" && form.bizTypeOtherDescribe.trim() ? (
                  <div className="relative w-full rounded-xl border-2 border-dashed border-violet-400 px-4 py-3 pr-11 transition hover:border-violet-500 hover:bg-violet-50/40">
                    <button
                      type="button"
                      onClick={() => {
                        setOtherTypeModalSeed(form.bizTypeOtherDescribe);
                        setOtherTypeModalOpen(true);
                      }}
                      className="w-full text-left text-sm leading-relaxed text-slate-800"
                    >
                      {form.bizTypeOtherDescribe}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRemoveOtherTypeConfirmOpen(true)}
                      aria-label="Remove custom business type"
                      className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-lg font-bold leading-none text-red-500 transition hover:bg-red-50"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      {BIZ_CATEGORY_PRESETS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            clearField("bizBusinessCategory");
                            clearField("bizTypeOtherDescribe");
                            patch(businessCategoryPatch(preset.value));
                          }}
                          className={`${choiceBtn} ${
                            form.bizBusinessCategory === preset.value
                              ? choiceBtnOn
                              : fieldErr("bizBusinessCategory")
                                ? choiceBtnErr
                                : choiceBtnOff
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setOtherTypeModalSeed("");
                        setOtherTypeModalOpen(true);
                      }}
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-violet-800"
                    >
                      <EditIcon />
                      Other
                    </button>
                  </>
                )}
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Team Setup</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {BIZ_TEAM_SETUP_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        clearField("bizStaffCount");
                        patch({ bizStaffCount: opt.value });
                      }}
                      className={`${choiceBtn} ${
                        form.bizStaffCount === opt.value
                          ? choiceBtnOn
                          : fieldErr("bizStaffCount")
                            ? choiceBtnErr
                            : choiceBtnOff
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-500">You&apos;ll be able to invite staff later.</p>
              </div>
            </div>

          </div>
        </SignupStepShell>
      );
    }

    if (step === 2) {
      const venueNameLabel = venueNameFieldLabel(form);

      return (
        <SignupStepShell
          stepKey={step}
          iconSrc={VENUE_ICON}
          iconClassName="h-28 w-28 opacity-100 drop-shadow-[0_3px_10px_rgba(15,23,42,0.28)] contrast-125 sm:h-32 sm:w-32"
          title={venueStepTitle(form)}
          description={
            <p className="mx-auto w-max max-w-none whitespace-nowrap text-sm sm:text-base">
              Help us prepare your ServeOS workspace and recommendations.
            </p>
          }
          descriptionClassName="w-full"
          footer={wizardFooter}
        >
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="min-w-0">
                <FieldLabel>{venueNameLabel}</FieldLabel>
                <TextField
                  value={form.bizVenueTradingName}
                  onChange={(v) => {
                    clearField("bizVenueTradingName");
                    patch({ bizVenueTradingName: v });
                  }}
                  placeholder={venueNameLabel}
                  error={fieldErr("bizVenueTradingName")}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>Address</FieldLabel>
                <TextField
                  value={form.bizEstablishmentLocation}
                  onChange={(v) => {
                    clearField("bizEstablishmentLocation");
                    patch({ bizEstablishmentLocation: v });
                  }}
                  placeholder="Street address"
                  error={fieldErr("bizEstablishmentLocation")}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>Country</FieldLabel>
                <button
                  type="button"
                  onClick={() => setVenueCountryModalOpen(true)}
                  className={`${inputBase} flex w-full items-center justify-between text-left ${
                    fieldErr("bizVenueCountry") ? inputErr : ""
                  }`}
                >
                  <span className="truncate">{countryPickerLabel(form.bizVenueCountry)}</span>
                  <span className="ml-2 text-xs font-bold text-slate-400" aria-hidden>
                    ▼
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
              <div className="min-w-0">
                <FieldLabel>Postal Code</FieldLabel>
                <TextField
                  value={form.bizVenuePostalCode}
                  onChange={(v) => {
                    clearField("bizVenuePostalCode");
                    patch({ bizVenuePostalCode: v });
                  }}
                  placeholder="Postal Code"
                  error={fieldErr("bizVenuePostalCode")}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>City</FieldLabel>
                <TextField
                  value={form.bizVenueCity}
                  onChange={(v) => {
                    clearField("bizVenueCity");
                    patch({ bizVenueCity: v });
                  }}
                  placeholder="City"
                  error={fieldErr("bizVenueCity")}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  clearField("bizEstablishmentLocation");
                  clearField("bizVenuePostalCode");
                  clearField("bizVenueCity");
                  clearField("bizVenueCountry");
                  patch(companyAddressForVenueCopy(form));
                }}
                className={`${primaryBtn} w-full py-3`}
              >
                Use Company&apos;s Address
              </button>
            </div>

            <div className="border-t border-slate-200/80 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                How many locations do you currently operate?
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {BIZ_LOCATION_BANDS.map((band) => (
                  <button
                    key={band.value}
                    type="button"
                    onClick={() => {
                      clearField("bizLocations");
                      patch({ bizLocations: band.value });
                    }}
                    className={`${choiceBtn} ${
                      form.bizLocations === band.value
                        ? choiceBtnOn
                        : fieldErr("bizLocations")
                          ? choiceBtnErr
                          : choiceBtnOff
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">You can add additional locations later.</p>
            </div>

            <div className="border-t border-slate-200/80 pt-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">You have a website?</h3>
              <TextField
                value={form.bizVenueWebsite}
                onChange={(v) => patch({ bizVenueWebsite: v })}
                type="url"
                placeholder="we can connect it to your ServeOS page later"
              />
            </div>
          </div>
        </SignupStepShell>
      );
    }

    if (step === 3) {
      return (
        <SignupStepShell
          stepKey={step}
          iconSrc={OWNER_ACCOUNT_ICON}
          title="Create Owner Account"
          footer={wizardFooter}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>Full name</FieldLabel>
              <TextField
                value={form.bizContact}
                onChange={(v) => {
                  clearField("bizContact");
                  patch({ bizContact: v });
                }}
                placeholder="Full name"
                error={fieldErr("bizContact")}
                autoComplete="name"
              />
            </div>
            <div>
              <FieldLabel>Work email</FieldLabel>
              <TextField
                value={form.email}
                onChange={(v) => {
                  clearField("bizEmail");
                  patch({ email: v });
                }}
                type="email"
                placeholder="Work email"
                error={fieldErr("bizEmail")}
                autoComplete="email"
              />
            </div>
            <div>
              <FieldLabel>Password</FieldLabel>
              <PasswordField
                value={form.password}
                onChange={(v) => {
                  clearField("bizPassword");
                  if (bizConfirmStarted && form.password2.trim()) {
                    const mismatch = v !== form.password2;
                    setBizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                    if (mismatch) {
                      setFieldErrors((prev) => ({ ...prev, bizPassword2: true }));
                    } else {
                      clearField("bizPassword2");
                    }
                  }
                  patch({ password: v });
                }}
                placeholder="Password"
                error={fieldErr("bizPassword")}
                autoComplete="new-password"
                showPassword={bizShowPass}
                onToggleShow={() => setBizShowPass((s) => !s)}
                disableToggle={bizConfirmEditing}
              />
            </div>
            <div>
              <FieldLabel>Confirm Password</FieldLabel>
              <PasswordField
                value={form.password2}
                onChange={(v) => {
                  if (!bizConfirmStarted) setBizConfirmStarted(true);
                  setBizConfirmEditing(true);
                  clearField("bizPassword2");
                  const mismatch =
                    v.trim().length > 0 && form.password.trim().length > 0 && v !== form.password;
                  setBizConfirmMismatch(mismatch ? "Passwords do not match" : null);
                  if (mismatch) {
                    setFieldErrors((prev) => ({ ...prev, bizPassword2: true }));
                  }
                  patch({ password2: v });
                }}
                onFocus={() => {
                  if (!bizConfirmStarted) setBizConfirmStarted(true);
                  setBizConfirmEditing(true);
                }}
                onBlur={() => setBizConfirmEditing(false)}
                placeholder="Confirm Password"
                error={fieldErr("bizPassword2") || Boolean(bizConfirmMismatch)}
                autoComplete="new-password"
                showPassword={bizShowConfirmPass}
                onToggleShow={() => setBizShowConfirmPass((s) => !s)}
              />
              {bizConfirmStarted && bizConfirmMismatch ? (
                <p className="mt-1.5 text-xs font-semibold text-red-600">{bizConfirmMismatch}</p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3">
              <p className="text-sm text-slate-600">Learn what your Owner account includes</p>
              <button
                type="button"
                onClick={() => setOwnerInfoModalOpen(true)}
                aria-label="Owner account details"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-violet-200/80 bg-white text-violet-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
              >
                <InfoIcon />
              </button>
            </div>
          </div>
        </SignupStepShell>
      );
    }

    return null;
  };

  const renderGuestStepBody = () => (
    <SignupStepShell
      stepKey={step}
      title={
        step === 0
          ? "Basic Identity"
          : step === 1
            ? "Access Security"
            : step === 2
              ? "Preferences"
              : "Your account is ready"
      }
      footer={wizardFooter}
    >
      {step === 0 ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>First name</FieldLabel>
                <TextField
                  value={form.guestFirst}
                  onChange={(v) => {
                    clearField("guestFirst");
                    patch({ guestFirst: v });
                  }}
                  placeholder="First name"
                  error={fieldErr("guestFirst")}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <FieldLabel>Last name</FieldLabel>
                <TextField
                  value={form.guestLast}
                  onChange={(v) => {
                    clearField("guestLast");
                    patch({ guestLast: v });
                  }}
                  placeholder="Last name"
                  error={fieldErr("guestLast")}
                  autoComplete="family-name"
                />
              </div>
            </div>
            <div>
              <FieldLabel>Email</FieldLabel>
              <TextField
                value={form.email}
                onChange={(v) => {
                  clearField("guestEmail");
                  patch({ email: v });
                }}
                type="email"
                placeholder="Email"
                error={fieldErr("guestEmail")}
                autoComplete="email"
              />
            </div>
            <div>
              <FieldLabel>Mobile number</FieldLabel>
              <TextField
                value={form.guestPhone}
                onChange={(v) => {
                  clearField("guestPhone");
                  patch({ guestPhone: v });
                }}
                type="tel"
                placeholder="Mobile number"
                error={fieldErr("guestPhone")}
                autoComplete="tel"
              />
            </div>
            <div>
              <FieldLabel>Country</FieldLabel>
              <select
                value={form.guestCountry}
                onChange={(e) => patch({ guestCountry: e.target.value as AllowedCountry, guestCity: "" })}
                className={inputBase}
              >
                {NORDIC_COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

      {step === 1 ? (
          <div className="space-y-4">
            <div>
              <FieldLabel>Password</FieldLabel>
              <TextField
                value={form.password}
                onChange={(v) => {
                  clearField("guestPassword");
                  patch({ password: v });
                }}
                type="password"
                placeholder="Password"
                error={fieldErr("guestPassword")}
                autoComplete="new-password"
              />
            </div>
            <div>
              <FieldLabel>Confirm password</FieldLabel>
              <TextField
                value={form.password2}
                onChange={(v) => {
                  clearField("guestPassword2");
                  patch({ password2: v });
                }}
                type="password"
                placeholder="Confirm password"
                error={fieldErr("guestPassword2")}
                autoComplete="new-password"
              />
            </div>
          </div>
        ) : null}

      {step === 2 ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Personalize your experience (optional).</p>
            <div>
              <FieldLabel>Preferred language</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => patch({ guestLanguage: "EN" })}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    form.guestLanguage === "EN"
                      ? "border-violet-300 bg-violet-100 text-violet-800"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-200"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-400"
                >
                  Swedish (soon)
                </button>
              </div>
            </div>
            <div>
              <FieldLabel>City / location</FieldLabel>
              <select
                value={form.guestCity}
                onChange={(e) => {
                  clearField("guestCity");
                  patch({ guestCity: e.target.value });
                }}
                className={`${inputBase} ${fieldErr("guestCity") ? inputErr : ""}`}
              >
                <option value="">Select city</option>
                {guestCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.guestOffers}
                onChange={(e) => patch({ guestOffers: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-sm text-slate-700">Receive marketing offers</span>
            </label>
          </div>
        ) : null}

      {step === 3 ? (
          <p className="text-center text-sm text-slate-600">
            Tap below to create your guest account and start exploring ServeOS.
          </p>
        ) : null}
    </SignupStepShell>
  );

  const showRegistrationLoader = isBusiness && (bizLookupBusy || busy || bizAccountCreating);
  const loaderMode = bizLookupBusy
    ? "company-lookup"
    : bizAccountCreating
      ? "account-creation"
      : "registration";

  return (
    <>
      <div className="signup-wizard-stage relative w-full">
        {showRegistrationLoader ? (
          <SignupRegistrationLoader mode={loaderMode} />
        ) : null}
        <div className={showRegistrationLoader ? "invisible" : undefined}>
          {bannerErr ? <p className="mb-4 text-center text-sm font-medium text-red-600">{bannerErr}</p> : null}
          {isBusiness ? renderBusinessStepBody() : renderGuestStepBody()}
        </div>
      </div>

      <BizOtherTypeModal
        open={otherTypeModalOpen}
        initialValue={otherTypeModalSeed}
        onClose={() => setOtherTypeModalOpen(false)}
        onSave={(value) => {
          clearField("bizBusinessCategory");
          clearField("bizTypeOtherDescribe");
          patch(businessCategoryPatch("other", value));
          setOtherTypeModalOpen(false);
        }}
      />

      <SignupConfirmModal
        open={removeOtherTypeConfirmOpen}
        title="Remove custom business type?"
        message="This will clear your description. You can choose a preset type or enter Other again."
        cancelLabel="Keep it"
        confirmLabel="Yes, remove"
        onCancel={() => setRemoveOtherTypeConfirmOpen(false)}
        onConfirm={() => {
          clearOtherBusinessType();
          setRemoveOtherTypeConfirmOpen(false);
        }}
      />

      <ChangeCompanyInfoModal
        open={changeCompanyModalOpen}
        initial={companyModalInitial}
        onClose={() => setChangeCompanyModalOpen(false)}
        onSave={saveCompanyInfo}
      />

      <VenueCountryModal
        open={venueCountryModalOpen}
        value={form.bizVenueCountry}
        onClose={() => setVenueCountryModalOpen(false)}
        onSelect={(country) => {
          clearField("bizVenueCountry");
          clearField("bizVenueCity");
          patch({ bizVenueCountry: country, bizVenueCity: "" });
        }}
      />

      <OwnerAccountInfoModal open={ownerInfoModalOpen} onClose={() => setOwnerInfoModalOpen(false)} />

      <AccountCreationInfoModal
        open={accountCreationInfoOpen}
        onClose={() => setAccountCreationInfoOpen(false)}
      />
    </>
  );
}
