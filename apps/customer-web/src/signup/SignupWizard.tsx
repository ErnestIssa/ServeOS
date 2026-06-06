import {
  BUSINESS_TOTAL_STEPS,
  ESTABLISHMENT_TYPES,
  GUEST_TOTAL_STEPS,
  NORDIC_COUNTRIES,
  businessWizardStepValidation,
  citiesForCountry,
  createInitialSignupForm,
  establishmentKindLabel,
  evaluateBusinessSignupForFinish,
  evaluateGuestSignupForFinish,
  guestWizardStepValidation,
  normalizeCityFromRegistry,
  readableAuthFailure,
  type AllowedCountry,
  type EstablishmentBizType,
  type SignupFlow,
  type SignupFormState
} from "@serveos/core-shared";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { authSignup, lookupCompany } from "../api";
import { BtnPrimary, BtnSecondary } from "../marketing/ui";

const inputBase =
  "w-full rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60";
const inputErr = "border-red-400 bg-red-50/60 focus:border-red-400 focus:ring-red-200/60";
const labelCls = "mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";
const sectionTitle = "font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl";

type Props = {
  flow: SignupFlow;
  onExit: () => void;
  onSuccess: (role: "CUSTOMER" | "OWNER") => void;
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

export function SignupWizard({ flow, onExit, onSuccess }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<SignupFormState>(createInitialSignupForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [bannerErr, setBannerErr] = useState<string | null>(null);
  const [btnErr, setBtnErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bizLookupBusy, setBizLookupBusy] = useState(false);
  const [bizLookupMsg, setBizLookupMsg] = useState<string | null>(null);

  const totalSteps = flow === "BUSINESS" ? BUSINESS_TOTAL_STEPS : GUEST_TOTAL_STEPS;
  const isBusiness = flow === "BUSINESS";
  const progress = ((step + 1) / totalSteps) * 100;

  const patch = useCallback((partial: Partial<SignupFormState>) => {
    setForm((f) => ({ ...f, ...partial }));
    setBannerErr(null);
    setBtnErr(null);
  }, []);

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

  const goNext = () => {
    setBannerErr(null);
    setBtnErr(null);

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
    } else if (step >= 1 && step <= 7) {
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

  const finishLabel = isBusiness ? "Launch Dashboard" : "Start Exploring";
  const wizardTitle = isBusiness ? "Create your business account" : "Create your personal account";

  const guestCities = useMemo(() => citiesForCountry(form.guestCountry), [form.guestCountry]);
  const bizCities = useMemo(() => citiesForCountry(form.bizCountry), [form.bizCountry]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
          <span>{wizardTitle}</span>
          <span>
            Step {step + 1} of {totalSteps}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              isBusiness ? "bg-gradient-to-r from-blue-600 to-violet-600" : "bg-gradient-to-r from-emerald-500 to-teal-500"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div
        className={`rounded-2xl border p-6 shadow-[0_8px_32px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:p-8 ${
          isBusiness
            ? "border-blue-200/60 bg-gradient-to-b from-white/95 to-blue-50/40"
            : "border-emerald-200/60 bg-gradient-to-b from-white/95 to-emerald-50/30"
        }`}
      >
        {bannerErr ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {bannerErr}
          </p>
        ) : null}

        {!isBusiness && step === 0 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Basic Identity</h3>
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

        {!isBusiness && step === 1 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Access Security</h3>
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

        {!isBusiness && step === 2 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Preferences</h3>
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

        {!isBusiness && step === 3 ? (
          <div className="py-4 text-center">
            <h3 className="font-display text-2xl font-extrabold text-slate-900">Your account is ready</h3>
            <p className="mt-3 text-sm text-slate-600">
              Tap below to create your guest account and start exploring ServeOS.
            </p>
          </div>
        ) : null}

        {isBusiness && step === 0 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Organisation lookup</h3>
            <p className="text-sm text-slate-600">Enter your Swedish organisation number to pre-fill company details.</p>
            <div>
              <FieldLabel>Organisation number</FieldLabel>
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
            </div>
            {bizLookupMsg ? <p className="text-sm font-medium text-red-600">{bizLookupMsg}</p> : null}
          </div>
        ) : null}

        {isBusiness && step === 1 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Business Identity</h3>
            {form.bizCompanyFieldsLocked ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel>Legal company name</FieldLabel>
                  <TextField value={form.bizName} onChange={() => undefined} disabled error={fieldErr("bizName")} />
                </div>
                <div>
                  <FieldLabel>Legal form</FieldLabel>
                  <TextField value={form.bizLegalFormLocked || "—"} onChange={() => undefined} disabled />
                </div>
                <div>
                  <FieldLabel>Registration status</FieldLabel>
                  <TextField value={form.bizRegStatusLocked || "—"} onChange={() => undefined} disabled />
                </div>
                <div>
                  <FieldLabel>Postal code</FieldLabel>
                  <TextField value={form.bizPostalLocked || "—"} onChange={() => undefined} disabled />
                </div>
              </div>
            ) : (
              <div>
                <FieldLabel>Legal company name</FieldLabel>
                <TextField
                  value={form.bizName}
                  onChange={(v) => {
                    clearField("bizName");
                    patch({ bizName: v });
                  }}
                  placeholder="Business name"
                  error={fieldErr("bizName")}
                />
              </div>
            )}
            <div>
              <FieldLabel>Contact person full name</FieldLabel>
              <TextField
                value={form.bizContact}
                onChange={(v) => {
                  clearField("bizContact");
                  patch({ bizContact: v });
                }}
                placeholder="Full name"
                error={fieldErr("bizContact")}
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
              <FieldLabel>Mobile number</FieldLabel>
              <TextField
                value={form.bizPhone}
                onChange={(v) => {
                  clearField("bizPhone");
                  patch({ bizPhone: v });
                }}
                type="tel"
                placeholder="Mobile number"
                error={fieldErr("bizPhone")}
              />
            </div>
          </div>
        ) : null}

        {isBusiness && step === 2 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Business Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel>Country</FieldLabel>
                <select
                  value={form.bizCountry}
                  disabled={form.bizCompanyFieldsLocked}
                  onChange={(e) => patch({ bizCountry: e.target.value as AllowedCountry, bizCity: "" })}
                  className={inputBase}
                >
                  {NORDIC_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>City</FieldLabel>
                <select
                  value={form.bizCity}
                  disabled={form.bizCompanyFieldsLocked}
                  onChange={(e) => {
                    clearField("bizCity");
                    patch({ bizCity: e.target.value });
                  }}
                  className={`${inputBase} ${fieldErr("bizCity") ? inputErr : ""}`}
                >
                  <option value="">Select city</option>
                  {bizCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>Number of locations</FieldLabel>
              <TextField
                value={form.bizLocations}
                onChange={(v) => {
                  clearField("bizLocations");
                  patch({ bizLocations: v });
                }}
                placeholder="1"
                error={fieldErr("bizLocations")}
              />
            </div>
          </div>
        ) : null}

        {isBusiness && step === 3 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Registered address</h3>
            <div>
              <FieldLabel>Legal company address</FieldLabel>
              <TextField
                value={form.bizAddress}
                onChange={(v) => {
                  clearField("bizAddress");
                  patch({ bizAddress: v });
                }}
                disabled={form.bizCompanyFieldsLocked}
                placeholder="Street address"
                error={fieldErr("bizAddress")}
              />
            </div>
          </div>
        ) : null}

        {isBusiness && step === 4 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Establishment type</h3>
            <div className="flex flex-wrap gap-2">
              {ESTABLISHMENT_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    clearField("bizType");
                    patch({ bizType: t });
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                    form.bizType === t
                      ? "border-blue-400 bg-blue-100 text-blue-900"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
                  }`}
                >
                  {establishmentKindLabel(t)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isBusiness && step === 5 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Your {establishmentKindLabel(form.bizType)}</h3>
            <div>
              <FieldLabel>{establishmentKindLabel(form.bizType)} name</FieldLabel>
              <TextField
                value={form.bizVenueTradingName}
                onChange={(v) => {
                  clearField("bizVenueTradingName");
                  patch({ bizVenueTradingName: v });
                }}
                placeholder="Trading name"
                error={fieldErr("bizVenueTradingName")}
              />
            </div>
            {form.bizType === "Other" ? (
              <div>
                <FieldLabel>Describe what this business is</FieldLabel>
                <TextField
                  value={form.bizTypeOtherDescribe}
                  onChange={(v) => {
                    clearField("bizTypeOtherDescribe");
                    patch({ bizTypeOtherDescribe: v });
                  }}
                  placeholder="e.g. Food truck, bar, catering"
                  error={fieldErr("bizTypeOtherDescribe")}
                />
              </div>
            ) : null}
            <div>
              <FieldLabel>Physical location</FieldLabel>
              <TextField
                value={form.bizEstablishmentLocation}
                onChange={(v) => {
                  clearField("bizEstablishmentLocation");
                  patch({ bizEstablishmentLocation: v });
                }}
                placeholder="Where guests find you"
                error={fieldErr("bizEstablishmentLocation")}
              />
            </div>
            <div>
              <FieldLabel>Food / service offerings</FieldLabel>
              <textarea
                value={form.bizOfferingsDescription}
                onChange={(e) => {
                  clearField("bizOfferingsDescription");
                  patch({ bizOfferingsDescription: e.target.value });
                }}
                rows={3}
                placeholder="What you serve or provide"
                className={`${inputBase} resize-y ${fieldErr("bizOfferingsDescription") ? inputErr : ""}`}
              />
            </div>
          </div>
        ) : null}

        {isBusiness && step === 6 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Operations Setup</h3>
            <div>
              <FieldLabel>Estimated monthly orders</FieldLabel>
              <TextField
                value={form.bizMonthlyOrders}
                onChange={(v) => {
                  clearField("bizMonthlyOrders");
                  patch({ bizMonthlyOrders: v });
                }}
                placeholder="e.g. 500"
                error={fieldErr("bizMonthlyOrders")}
              />
            </div>
            <div>
              <FieldLabel>Current system</FieldLabel>
              <TextField
                value={form.bizCurrentSystem}
                onChange={(v) => {
                  clearField("bizCurrentSystem");
                  patch({ bizCurrentSystem: v });
                }}
                placeholder="e.g. Toast, Square, pen & paper"
                error={fieldErr("bizCurrentSystem")}
              />
            </div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.bizNeedBookings}
                onChange={(e) => patch({ bizNeedBookings: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm text-slate-700">Need bookings / reservations</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={form.bizNeedDelivery}
                onChange={(e) => patch({ bizNeedDelivery: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm text-slate-700">Need delivery / pickup</span>
            </label>
          </div>
        ) : null}

        {isBusiness && step === 7 ? (
          <div className="space-y-4">
            <h3 className={sectionTitle}>Security & Ownership</h3>
            <div>
              <FieldLabel>Password</FieldLabel>
              <TextField
                value={form.password}
                onChange={(v) => {
                  clearField("bizPassword");
                  patch({ password: v });
                }}
                type="password"
                error={fieldErr("bizPassword")}
                autoComplete="new-password"
              />
            </div>
            <div>
              <FieldLabel>Confirm password</FieldLabel>
              <TextField
                value={form.password2}
                onChange={(v) => {
                  clearField("bizPassword2");
                  patch({ password2: v });
                }}
                type="password"
                error={fieldErr("bizPassword2")}
                autoComplete="new-password"
              />
            </div>
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${fieldErr("bizAcceptTerms") ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white/60"}`}>
              <input
                type="checkbox"
                checked={form.bizAcceptTerms}
                onChange={(e) => {
                  clearField("bizAcceptTerms");
                  patch({ bizAcceptTerms: e.target.checked });
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm text-slate-700">I accept the ServeOS terms of service</span>
            </label>
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${fieldErr("bizAuthorized") ? "border-red-300 bg-red-50/50" : "border-slate-200 bg-white/60"}`}>
              <input
                type="checkbox"
                checked={form.bizAuthorized}
                onChange={(e) => {
                  clearField("bizAuthorized");
                  patch({ bizAuthorized: e.target.checked });
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600"
              />
              <span className="text-sm text-slate-700">I am authorized to represent this business</span>
            </label>
          </div>
        ) : null}

        {isBusiness && step === 8 ? (
          <div className="py-4 text-center">
            <h3 className="font-display text-2xl font-extrabold text-slate-900">Almost there</h3>
            <p className="mt-3 text-sm text-slate-600">
              We&apos;ll create your business account, company profile, and first venue in one step.
            </p>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <BtnSecondary onClick={goBack} className="sm:min-w-[7rem]">
            {step === 0 ? "Back" : "Previous"}
          </BtnSecondary>
          {isBusiness && step === 0 ? (
            <BtnPrimary onClick={() => void runOrgLookup()} className="sm:min-w-[10rem]">
              {bizLookupBusy ? "Looking up…" : "Continue"}
            </BtnPrimary>
          ) : (
            <BtnPrimary onClick={goNext} className="sm:min-w-[10rem]">
              {busy ? "Creating account…" : step >= totalSteps - 1 ? finishLabel : "Continue"}
            </BtnPrimary>
          )}
        </div>
        {btnErr ? <p className="mt-3 text-center text-sm font-medium text-red-600">{btnErr}</p> : null}
      </div>
    </div>
  );
}
