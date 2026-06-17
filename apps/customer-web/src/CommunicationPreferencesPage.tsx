import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { iconPath } from "./marketing/assetPaths";
import { ServeOsWordmark, SignupStepShell } from "./signup/SignupShell";
import {
  EMAIL_PREFERENCE_ITEMS,
  IN_APP_PREFERENCE_ITEMS,
  TRANSACTIONAL_ALWAYS_ON,
  type CommunicationPreferencesState,
  type EmailPreferenceKey,
  type InAppPreferenceKey
} from "./preferences/communicationCategories";
import { PreferenceToggle } from "./preferences/PreferenceToggle";
import {
  enableAllCommunications,
  fetchCommunicationPreferences,
  requestPreferencesLookup,
  saveCommunicationPreferences,
  unsubscribeAllNonEssential,
  type CommunicationPreferencesPreview
} from "./preferences/communicationPreferencesApi";
import { readStoredAdminToken } from "./authStorage";

const PREF_ICON = iconPath("mail-unsub-svgrepo-com.svg");

type Phase = "loading" | "lookup" | "prefs" | "lookup_sent";

type Props = {
  onBack: () => void;
};

const TYPE_ALIASES: Record<string, EmailPreferenceKey | InAppPreferenceKey> = {
  marketing: "marketing",
  newsletter: "newsletter",
  product: "productUpdates",
  product_updates: "productUpdates",
  events: "events",
  event: "events",
  partner: "partner",
  feature_tips: "featureTips",
  tips: "featureTips",
  suggestions: "productSuggestions",
  insights: "usageInsights",
  promotions: "promotions"
};

function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get("token")?.trim() || null,
    type: params.get("type")?.trim().toLowerCase() || null,
    oneClick: params.get("oneClick") === "true" || params.get("oneClick") === "1"
  };
}

function formatUpdatedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(iso)
    );
  } catch {
    return iso;
  }
}

function PreferencesBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md transition hover:border-violet-200 hover:bg-white hover:text-slate-900"
    >
      <span aria-hidden className="inline-block transition-transform duration-200 group-hover:-translate-x-0.5">
        ←
      </span>
      Back
    </button>
  );
}

function PreferenceSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="comm-pref-section">
      <div className="comm-pref-section-head">
        <h2 className="comm-pref-section-title">{title}</h2>
        {description ? <p className="comm-pref-section-desc">{description}</p> : null}
      </div>
      <div className="comm-pref-section-body">{children}</div>
    </section>
  );
}

export function CommunicationPreferencesPage({ onBack }: Props) {
  const urlParams = useMemo(readUrlParams, []);
  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<CommunicationPreferencesPreview | null>(null);
  const [prefs, setPrefs] = useState<CommunicationPreferencesState | null>(null);
  const [highlightKey, setHighlightKey] = useState<string | null>(null);
  const [lookupEmail, setLookupEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expiredMasked, setExpiredMasked] = useState<string | null>(null);

  const prefToken = urlParams.token;
  const hasSession = Boolean(readStoredAdminToken());

  const applyPreview = useCallback((data: CommunicationPreferencesPreview) => {
    setPreview(data);
    setPrefs(data.preferences);
    setPhase("prefs");
  }, []);

  const loadPreferences = useCallback(async () => {
    setError(null);
    setPhase("loading");
    const result = await fetchCommunicationPreferences(prefToken ?? undefined);
    if (result.ok) {
      applyPreview(result);
      return;
    }
    if (result.error === "token_expired") {
      setExpiredMasked(result.emailMasked ?? null);
      setPhase("lookup");
      setError("This link has expired. Enter your email to request a new preferences link.");
      return;
    }
    if (prefToken) {
      setPhase("lookup");
      setError("This preferences link is invalid. Enter your email to request a new one.");
      return;
    }
    if (hasSession) {
      setPhase("lookup");
      setError("We could not load your preferences. Enter your email or sign in again.");
      return;
    }
    setPhase("lookup");
  }, [applyPreview, hasSession, prefToken]);

  useEffect(() => {
    void loadPreferences();
  }, [loadPreferences]);

  const oneClickApplied = useRef(false);

  useEffect(() => {
    if (!prefs || !urlParams.type || !urlParams.oneClick || oneClickApplied.current) return;
    const key = TYPE_ALIASES[urlParams.type];
    if (!key) return;
    oneClickApplied.current = true;
    setHighlightKey(key);

    void (async () => {
      const isEmail = EMAIL_PREFERENCE_ITEMS.some((item) => item.key === key);
      setBusy(true);
      const saved = await saveCommunicationPreferences({
        token: prefToken ?? undefined,
        emailPrefs: isEmail ? { [key as EmailPreferenceKey]: false } : undefined,
        inAppPrefs: !isEmail ? { [key as InAppPreferenceKey]: false } : undefined,
        source: "email_one_click"
      });
      setBusy(false);
      if (saved.ok) {
        applyPreview(saved);
        setStatus(`Updated — ${urlParams.type!.replace(/_/g, " ")} is now off.`);
      }
    })();
  }, [applyPreview, prefToken, prefs, urlParams.oneClick, urlParams.type]);

  useEffect(() => {
    if (!urlParams.type || urlParams.oneClick) return;
    const key = TYPE_ALIASES[urlParams.type];
    if (key) setHighlightKey(key);
  }, [urlParams.oneClick, urlParams.type]);

  async function persistPrefs(next: CommunicationPreferencesState) {
    setPrefs(next);
    setBusy(true);
    setStatus(null);
    const saved = await saveCommunicationPreferences({
      token: prefToken ?? undefined,
      emailPrefs: next.email,
      inAppPrefs: next.inApp,
      source: "web"
    });
    setBusy(false);
    if (saved.ok) {
      applyPreview(saved);
      setStatus("Preferences saved.");
      return;
    }
    setError("Could not save your preferences. Please try again.");
  }

  function updateEmailPref(key: EmailPreferenceKey, value: boolean) {
    if (!prefs) return;
    void persistPrefs({ ...prefs, email: { ...prefs.email, [key]: value } });
  }

  function updateInAppPref(key: InAppPreferenceKey, value: boolean) {
    if (!prefs) return;
    void persistPrefs({ ...prefs, inApp: { ...prefs.inApp, [key]: value } });
  }

  async function handleUnsubscribeAll() {
    setBusy(true);
    setStatus(null);
    const result = await unsubscribeAllNonEssential({
      token: prefToken ?? undefined,
      source: "web_unsubscribe_all"
    });
    setBusy(false);
    if (result.ok) {
      applyPreview(result);
      setStatus("You are unsubscribed from all non-essential communications.");
      return;
    }
    setError("Could not update preferences. Please try again.");
  }

  async function handleEnableAll() {
    setBusy(true);
    setStatus(null);
    const result = await enableAllCommunications({
      token: prefToken ?? undefined,
      source: "web_enable_all"
    });
    setBusy(false);
    if (result.ok) {
      applyPreview(result);
      setStatus("All optional communications are enabled again.");
      return;
    }
    setError("Could not update preferences. Please try again.");
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const email = lookupEmail.trim();
    if (!email) return;
    setBusy(true);
    setError(null);
    await requestPreferencesLookup(email);
    setBusy(false);
    setPhase("lookup_sent");
  }

  return (
    <div className="relative min-h-[100dvh] w-full bg-white/92">
      <div className="fixed left-5 top-6 z-50 sm:left-8 sm:top-8">
        <PreferencesBackButton onClick={onBack} />
      </div>

      <div className="fixed right-5 top-6 z-50 sm:right-8 sm:top-8">
        <ServeOsWordmark className="text-xl sm:text-2xl" />
      </div>

      <main className="flex min-h-[100dvh] flex-col px-5 pb-12 pt-20 sm:px-8 sm:pb-16 sm:pt-24">
        <div className="signup-slot mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center py-6">
          {phase === "loading" ? (
            <SignupStepShell
              stepKey="loading"
              iconSrc={PREF_ICON}
              title="Loading preferences"
              description={
                <p className="mx-auto max-w-md text-center text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                  Fetching your communication settings…
                </p>
              }
            />
          ) : null}

          {phase === "lookup" || phase === "lookup_sent" ? (
            <SignupStepShell
              stepKey={phase}
              iconSrc={PREF_ICON}
              title="Manage your communication preferences"
              description={
                <div className="flex w-full flex-col items-center gap-3">
                  <p className="mx-auto max-w-md text-center text-sm leading-relaxed sm:text-[15px] md:text-base">
                    Control what emails and notifications you receive from ServeOS.
                  </p>
                  {expiredMasked ? (
                    <p className="text-center text-sm text-slate-500">
                      Previous link for <span className="font-semibold">{expiredMasked}</span>
                    </p>
                  ) : null}
                  {error ? <p className="text-center text-sm font-medium text-rose-600">{error}</p> : null}
                </div>
              }
              descriptionClassName="w-full"
            >
              {phase === "lookup_sent" ? (
                <div className="comm-pref-lookup-sent">
                  <p className="text-center text-sm leading-relaxed text-slate-600">
                    If we have a profile for that address, we&apos;ll send a secure link to manage your preferences.
                    Check your inbox and spam folder.
                  </p>
                  <button
                    type="button"
                    className="mt-6 w-full text-center text-sm font-semibold text-violet-700 underline decoration-violet-300 underline-offset-2"
                    onClick={() => setPhase("lookup")}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form className="comm-pref-lookup-form" onSubmit={handleLookup}>
                  <label className="comm-pref-field-label" htmlFor="pref-email">
                    Email address
                  </label>
                  <input
                    id="pref-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={lookupEmail}
                    onChange={(e) => setLookupEmail(e.target.value)}
                    className="comm-pref-input"
                    placeholder="you@restaurant.com"
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-5 w-full rounded-full bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3.5 text-base font-bold text-white shadow-[0_4px_20px_rgba(124,58,237,0.25)] transition hover:from-violet-500 hover:to-blue-500 disabled:opacity-70"
                  >
                    {busy ? "Sending…" : "Send preferences link"}
                  </button>
                </form>
              )}
            </SignupStepShell>
          ) : null}

          {phase === "prefs" && preview && prefs ? (
            <SignupStepShell
              stepKey="prefs"
              iconSrc={PREF_ICON}
              iconClassName="h-16 w-16 opacity-90 sm:h-20 sm:w-20"
              title="Manage your communication preferences"
              description={
                <p className="mx-auto max-w-lg text-center text-sm leading-relaxed text-slate-500 sm:text-[15px]">
                  Control what emails and notifications you receive from ServeOS. Billing, security, and legal
                  messages always stay on.
                </p>
              }
              descriptionClassName="w-full"
            >
              <div className="comm-pref-dashboard">
                {status ? <p className="comm-pref-status">{status}</p> : null}
                {error ? <p className="comm-pref-error">{error}</p> : null}

                <div className="comm-pref-identity">
                  <p className="comm-pref-identity-label">Email</p>
                  <p className="comm-pref-identity-value">{preview.emailMasked}</p>
                  {preview.workspaces.length > 0 ? (
                    <>
                      <p className="comm-pref-identity-label mt-3">Workspace</p>
                      <p className="comm-pref-identity-value">{preview.workspaces.join(", ")}</p>
                    </>
                  ) : null}
                  <p className="comm-pref-identity-updated">
                    Last updated {formatUpdatedAt(preview.lastUpdatedAt)}
                  </p>
                </div>

                <PreferenceSection title="Email preferences" description="Optional marketing and editorial emails.">
                  {EMAIL_PREFERENCE_ITEMS.map((item) => (
                    <PreferenceToggle
                      key={item.key}
                      label={item.label}
                      hint={item.hint}
                      checked={prefs.email[item.key]}
                      highlighted={highlightKey === item.key}
                      disabled={busy}
                      onChange={(v) => updateEmailPref(item.key, v)}
                    />
                  ))}
                </PreferenceSection>

                <PreferenceSection title="In-app notifications" description="Non-critical tips and suggestions in the product.">
                  {IN_APP_PREFERENCE_ITEMS.map((item) => (
                    <PreferenceToggle
                      key={item.key}
                      label={item.label}
                      hint={item.hint}
                      checked={prefs.inApp[item.key]}
                      highlighted={highlightKey === item.key}
                      disabled={busy}
                      onChange={(v) => updateInAppPref(item.key, v)}
                    />
                  ))}
                </PreferenceSection>

                <div className="comm-pref-actions">
                  <button
                    type="button"
                    className="comm-pref-btn comm-pref-btn--danger"
                    disabled={busy}
                    onClick={() => void handleUnsubscribeAll()}
                  >
                    Unsubscribe from all non-essential communications
                  </button>
                  <button
                    type="button"
                    className="comm-pref-btn comm-pref-btn--secondary"
                    disabled={busy}
                    onClick={() => void handleEnableAll()}
                  >
                    Re-enable all communications
                  </button>
                </div>

                <div className="comm-pref-info">
                  <h3 className="comm-pref-info-title">Why am I getting this?</h3>
                  <p className="comm-pref-info-text">
                    You are receiving these emails because you signed up for updates from ServeOS or are part of a
                    restaurant workspace.
                  </p>
                </div>

                <div className="comm-pref-info comm-pref-info--muted">
                  <h3 className="comm-pref-info-title">Always on (cannot be turned off)</h3>
                  <ul className="comm-pref-essential-list">
                    {TRANSACTIONAL_ALWAYS_ON.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </SignupStepShell>
          ) : null}
        </div>
      </main>
    </div>
  );
}
