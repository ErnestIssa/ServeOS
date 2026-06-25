import { useCallback, useEffect, useState } from "react";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminEmptyState,
  AdminPanel,
  AdminSectionHeader,
  subPanelCls
} from "../AdminUi";
import { AdminSkeletonProfile } from "../AdminSkeleton";
import { ADMIN_TOP_HASHES } from "../adminTopHashes";
import {
  type AccountBundle,
  type PermissionsOverview,
  type SecurityActivityRow,
  type UserSessionRow,
  changePassword,
  disableTwoFactor,
  enableTwoFactor,
  fetchAccountProfile,
  fetchMePreferences,
  fetchPermissionsOverview,
  fetchSecurityActivity,
  fetchSessions,
  readApiMessage,
  patchAccountProfile,
  patchMePreferences,
  requestAccountClosure,
  requestEmailChange,
  requestOwnershipTransfer,
  revokeSession,
  setupTwoFactor,
  uploadProfileImage
} from "./accountApi";
import {
  ChangeEmailModal,
  ChangePasswordModal,
  ConfirmActionModal,
  SignOutSessionsModal,
  TwoFactorModal
} from "./ProfileModals";
import { AccountPreferencesCard, type AccountPrefsSnapshot } from "./AccountPreferencesCard";
import { PersonalInfoCard, type PersonalInfoSnapshot } from "./PersonalInfoCard";
import { ProfilePhotoModal } from "./ProfilePhotoModal";
import { SessionsCard } from "./SessionsCard";
import { ProfileSectionTitle, ProfileSignOutButton, ProfileStatusBanner, ProfileToggleRow } from "./ProfileUi";

const NOTIFICATION_TOGGLES = [
  { key: "STAFF", label: "New staff requests" },
  { key: "RESERVATION", label: "New reservations" },
  { key: "PAYMENT", label: "Failed payments" },
  { key: "SYSTEM", label: "Device offline alerts" },
  { key: "ORDER", label: "Security alerts" },
  { key: "CHAT", label: "Daily summaries" }
] as const;

function Chip({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "success" | "violet" }) {
  return <span className={`admin-page-chip admin-page-chip--${tone}`}>{children}</span>;
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  token: string;
  displayName: string;
  email?: string | null;
  onSignOut?: () => void;
  onEmailChanged?: (email: string) => void;
};

export function AdminProfilePage({ token, displayName, email, onSignOut, onEmailChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountBundle | null>(null);
  const [sessions, setSessions] = useState<UserSessionRow[]>([]);
  const [activity, setActivity] = useState<SecurityActivityRow[]>([]);
  const [permissions, setPermissions] = useState<PermissionsOverview | null>(null);
  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true,
    emailEnabled: true,
    smsEnabled: false,
    categoryFlags: {} as Record<string, boolean>
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [savedProfile, setSavedProfile] = useState<PersonalInfoSnapshot>({
    fullName: "",
    phone: "",
    jobTitle: ""
  });
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState("Europe/Stockholm");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [timeFormat, setTimeFormat] = useState("12h");
  const [theme, setTheme] = useState("system");
  const [savedAccountPrefs, setSavedAccountPrefs] = useState<AccountPrefsSnapshot>({
    language: "en",
    timezone: "Europe/Stockholm",
    dateFormat: "YYYY-MM-DD",
    timeFormat: "12h",
    theme: "system"
  });
  const [photoModal, setPhotoModal] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [emailModal, setEmailModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [twoFaModal, setTwoFaModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [closureModal, setClosureModal] = useState(false);
  const [sessionsModal, setSessionsModal] = useState(false);
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const [profileRes, sessionsRes, activityRes, permsRes, prefsRes] = await Promise.all([
      fetchAccountProfile(token),
      fetchSessions(token),
      fetchSecurityActivity(token, 90),
      fetchPermissionsOverview(token),
      fetchMePreferences(token)
    ]);

    if (profileRes.ok && profileRes.account) {
      const a = profileRes.account;
      setAccount(a);
      const profileFields = {
        fullName: a.fullName ?? displayName,
        phone: a.phone ?? "",
        jobTitle: a.jobTitle ?? ""
      };
      setFullName(profileFields.fullName);
      setPhone(profileFields.phone);
      setJobTitle(profileFields.jobTitle);
      setSavedProfile(profileFields);
      const prefs = {
        language: a.preferences.language,
        timezone: a.preferences.timezone,
        dateFormat: a.preferences.dateFormat,
        timeFormat: a.preferences.timeFormat,
        theme: a.preferences.theme
      };
      setLanguage(prefs.language);
      setTimezone(prefs.timezone);
      setDateFormat(prefs.dateFormat);
      setTimeFormat(prefs.timeFormat);
      setTheme(prefs.theme);
      setSavedAccountPrefs(prefs);
    }

    if (sessionsRes.ok && sessionsRes.sessions) setSessions(sessionsRes.sessions);
    if (activityRes.ok && activityRes.activity) setActivity(activityRes.activity);
    if (permsRes.ok && permsRes.permissions) setPermissions(permsRes.permissions);
    if (prefsRes.ok && prefsRes.notificationPreferences) {
      const np = prefsRes.notificationPreferences;
      setNotifPrefs({
        pushEnabled: np.pushEnabled,
        emailEnabled: np.emailEnabled,
        smsEnabled: np.smsEnabled,
        categoryFlags: np.categoryFlags ?? {}
      });
    }
    setLoading(false);
  }, [token, displayName]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function saveProfile() {
    setBusy(true);
    setStatus(null);
    const res = await patchAccountProfile(token, { fullName, phone, jobTitle });
    setBusy(false);
    if (!res.ok) {
      setStatus(readApiMessage(res));
      return;
    }
    if (res.account) setAccount(res.account);
    const next = { fullName, phone, jobTitle };
    setSavedProfile(next);
    setStatus("Profile saved.");
  }

  async function saveAccountPreferences() {
    setBusy(true);
    setStatus(null);
    const res = await patchMePreferences(token, {
      language,
      timezone,
      dateFormat,
      timeFormat: timeFormat as "12h" | "24h",
      theme: theme as "system" | "light" | "dark"
    });
    setBusy(false);
    if (!res.ok) {
      setStatus(readApiMessage(res));
      return;
    }
    const next = { language, timezone, dateFormat, timeFormat, theme };
    setSavedAccountPrefs(next);
    setStatus("Preferences saved.");
  }

  async function saveNotificationPreferences() {
    setBusy(true);
    setStatus(null);
    const res = await patchMePreferences(token, { notificationPreferences: notifPrefs });
    setBusy(false);
    setStatus(res.ok ? "Notification settings saved." : readApiMessage(res));
  }

  const initial = (fullName || displayName).charAt(0).toUpperCase() || "O";
  const primaryVenue = account?.venues[0];

  return (
    <AdminPanel id={ADMIN_TOP_HASHES.profile.slice(1)} className="admin-top-page admin-panel--edge">
      <AdminSectionHeader
        eyebrowText="Account"
        title="Your profile"
        description="Personal details, security, sessions, and workspace preferences — synced from your account service."
        action={onSignOut ? <ProfileSignOutButton onClick={onSignOut} /> : undefined}
      />

      {status ? (
        <div className="mt-4">
          <ProfileStatusBanner tone="success">{status}</ProfileStatusBanner>
        </div>
      ) : null}

      {loading ? (
        <AdminSkeletonProfile />
      ) : (
        <div className="mt-8 space-y-5">
          <div className="grid gap-5 xl:grid-cols-12">
            <div className={`${subPanelCls} admin-top-page-card admin-profile-identity-card xl:col-span-4`}>
              <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:gap-4 sm:text-left">
                <button
                  type="button"
                  className="admin-profile-avatar-btn group"
                  onClick={() => setPhotoModal(true)}
                  aria-label="Edit profile photo"
                >
                  {account?.profileImageUrl ? (
                    <img src={account.profileImageUrl} alt="" className="admin-profile-avatar-img" />
                  ) : (
                    <span className="admin-profile-avatar-fallback">{initial}</span>
                  )}
                  <span className="admin-profile-avatar-edit">Edit</span>
                </button>
                <div className="mt-4 min-w-0 sm:mt-1">
                  <p className="font-display text-xl font-bold text-slate-900">{fullName || displayName}</p>
                  <p className="mt-1 truncate text-sm text-slate-600">{account?.email ?? email}</p>
                  <Chip tone="violet">{permissions?.platformRole ?? account?.role ?? "Owner"}</Chip>
                  {account?.profileUpdatedAt ? (
                    <p className="mt-2 text-[11px] text-slate-500">Updated {formatWhen(account.profileUpdatedAt)}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2 sm:justify-start">
                <AdminBtnSecondary onClick={() => setPhotoModal(true)}>Upload photo</AdminBtnSecondary>
                <AdminBtnSecondary onClick={() => setEmailModal(true)}>Change email</AdminBtnSecondary>
              </div>
            </div>

            <PersonalInfoCard
              busy={busy}
              saved={savedProfile}
              fullName={fullName}
              phone={phone}
              jobTitle={jobTitle}
              onFullNameChange={setFullName}
              onPhoneChange={setPhone}
              onJobTitleChange={setJobTitle}
              onSave={() => void saveProfile()}
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={`${subPanelCls} admin-top-page-card`}>
              <ProfileSectionTitle>Password management</ProfileSectionTitle>
              <p className="mt-2 text-sm text-slate-600">
                {account?.twoFactor.enabled
                  ? "Two-factor authentication is enabled."
                  : "Protect your account with a strong password and 2FA."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <AdminBtnPrimary onClick={() => setPasswordModal(true)}>Change password</AdminBtnPrimary>
                <AdminBtnSecondary onClick={() => setTwoFaModal(true)}>
                  {account?.twoFactor.enabled ? "Manage 2FA" : "Enable 2FA"}
                </AdminBtnSecondary>
              </div>
            </div>

            <SessionsCard sessions={sessions} onManageSessions={() => setSessionsModal(true)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <AccountPreferencesCard
              busy={busy}
              saved={savedAccountPrefs}
              language={language}
              timezone={timezone}
              dateFormat={dateFormat}
              timeFormat={timeFormat}
              theme={theme}
              onLanguageChange={setLanguage}
              onTimezoneChange={setTimezone}
              onDateFormatChange={setDateFormat}
              onTimeFormatChange={(v) => setTimeFormat(v)}
              onThemeChange={(v) => setTheme(v)}
              onSave={() => void saveAccountPreferences()}
            />

            <div className={`${subPanelCls} admin-top-page-card`}>
              <ProfileSectionTitle>Notifications</ProfileSectionTitle>
              <div className="mt-4 space-y-1">
                <ProfileToggleRow
                  label="Email notifications"
                  checked={notifPrefs.emailEnabled}
                  onChange={(emailEnabled) => setNotifPrefs((p) => ({ ...p, emailEnabled }))}
                />
                <ProfileToggleRow
                  label="Push notifications"
                  checked={notifPrefs.pushEnabled}
                  onChange={(pushEnabled) => setNotifPrefs((p) => ({ ...p, pushEnabled }))}
                />
                <ProfileToggleRow
                  label="SMS notifications"
                  checked={notifPrefs.smsEnabled}
                  onChange={(smsEnabled) => setNotifPrefs((p) => ({ ...p, smsEnabled }))}
                />
              </div>
              <div className="admin-profile-toggle-divider mt-4 space-y-1 pt-4">
                {NOTIFICATION_TOGGLES.map((item) => (
                  <ProfileToggleRow
                    key={item.key}
                    label={item.label}
                    checked={notifPrefs.categoryFlags[item.key] !== false}
                    onChange={(checked) =>
                      setNotifPrefs((p) => ({
                        ...p,
                        categoryFlags: { ...p.categoryFlags, [item.key]: checked }
                      }))
                    }
                  />
                ))}
              </div>
              <div className="mt-4">
                <AdminBtnSecondary disabled={busy} onClick={() => void saveNotificationPreferences()}>
                  Save notification settings
                </AdminBtnSecondary>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className={`${subPanelCls} admin-top-page-card`}>
              <ProfileSectionTitle>Security activity</ProfileSectionTitle>
              <ul className="admin-profile-activity-list mt-4 max-h-64 space-y-2 overflow-y-auto">
                {activity.length === 0 ? (
                  <li className="text-sm text-slate-500">No recent security events.</li>
                ) : (
                  activity.map((row) => (
                    <li key={row.id} className="admin-security-activity-row text-sm">
                      <p className="font-semibold text-slate-800">{row.label}</p>
                      <p className="text-xs text-slate-500">
                        {formatWhen(row.createdAt)}
                        {row.ipMasked ? ` · ${row.ipMasked}` : ""}
                      </p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className={`${subPanelCls} admin-top-page-card`}>
              <ProfileSectionTitle>Permissions overview</ProfileSectionTitle>
              <p className="mt-2 text-sm text-slate-600">
                Role: <span className="font-semibold">{permissions?.venueRole ?? account?.role}</span>
                {permissions?.venueName ? ` · ${permissions.venueName}` : ""}
              </p>
              <ul className="admin-profile-permissions-list mt-4 space-y-2">
                {(permissions?.highlights ?? []).map((p) => (
                  <li key={p.key} className={`admin-profile-permission-row ${p.granted ? "is-granted" : ""}`}>
                    <span className="admin-profile-permission-icon" aria-hidden>
                      {p.granted ? "✓" : "○"}
                    </span>
                    <span>{p.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className={`${subPanelCls} admin-top-page-card`}>
            <ProfileSectionTitle>Venue access</ProfileSectionTitle>
            <p className="mt-2 text-sm text-slate-600">
              {account?.venues.length
                ? `Assigned locations (${account.venues.length})`
                : "No active venue memberships."}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {(account?.venues ?? []).map((v) => (
                <li key={v.id} className="admin-venue-pill">
                  {v.name}
                </li>
              ))}
            </ul>
            <a href="#ws-config/locations" className="admin-page-text-link mt-4 inline-block text-sm font-semibold">
              Manage locations →
            </a>
          </div>

          <div className={`${subPanelCls} admin-top-page-card admin-danger-zone admin-profile-danger-zone`}>
            <p className="admin-profile-section-title admin-profile-section-title--danger">Danger zone</p>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Transfer ownership or request account closure. These actions require verification and support review.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminBtnSecondary disabled={!primaryVenue} onClick={() => setTransferModal(true)}>
                Transfer ownership
              </AdminBtnSecondary>
              <button
                type="button"
                className="admin-page-danger-btn rounded-full px-4 py-2 text-xs font-bold"
                onClick={() => setClosureModal(true)}
              >
                Request account closure
              </button>
            </div>
          </div>
        </div>
      )}

      <ProfilePhotoModal
        open={photoModal}
        busy={photoBusy}
        currentImageUrl={account?.profileImageUrl}
        onClose={() => setPhotoModal(false)}
        onSave={async (file) => {
          setPhotoBusy(true);
          const res = await uploadProfileImage(token, file);
          setPhotoBusy(false);
          if (res.ok && res.profileImageUrl) {
            setAccount((prev) => (prev ? { ...prev, profileImageUrl: res.profileImageUrl! } : prev));
            setStatus("Profile photo updated.");
          }
          return res;
        }}
      />

      <SignOutSessionsModal
        open={sessionsModal}
        busy={sessionsBusy}
        sessions={sessions}
        onClose={() => setSessionsModal(false)}
        onConfirm={async (sessionIds) => {
          setSessionsBusy(true);
          let signedOut = 0;
          let lastError: string | undefined;
          for (const id of sessionIds) {
            const res = await revokeSession(token, id);
            if (res.ok) signedOut += 1;
            else lastError = res.error;
          }
          setSessionsBusy(false);
          if (signedOut === 0) return { ok: false, error: lastError ?? "revoke_failed" };
          await reload();
          setStatus(signedOut === 1 ? "1 session signed out." : `${signedOut} sessions signed out.`);
          return { ok: true, signedOut };
        }}
      />

      <ChangeEmailModal
        open={emailModal}
        currentEmail={account?.email ?? email}
        busy={busy}
        onClose={() => setEmailModal(false)}
        onSubmit={async (newEmail, password) => {
          setBusy(true);
          const res = await requestEmailChange(token, newEmail, password);
          setBusy(false);
          return res;
        }}
      />

      <ChangePasswordModal
        open={passwordModal}
        busy={busy}
        onClose={() => setPasswordModal(false)}
        onSubmit={async (body) => {
          setBusy(true);
          const res = await changePassword(token, body);
          setBusy(false);
          return res;
        }}
      />

      <TwoFactorModal
        open={twoFaModal}
        enabled={account?.twoFactor.enabled ?? false}
        busy={busy}
        otpauthUrl={otpauthUrl}
        onClose={() => {
          setTwoFaModal(false);
          setOtpauthUrl(null);
        }}
        onSetup={async () => {
          setBusy(true);
          const res = await setupTwoFactor(token);
          setBusy(false);
          if (res.ok && res.otpauthUrl) setOtpauthUrl(res.otpauthUrl);
        }}
        onEnable={async (code) => {
          setBusy(true);
          const res = await enableTwoFactor(token, code);
          setBusy(false);
          if (res.ok) void reload();
          return res;
        }}
        onDisable={async (password, code) => {
          setBusy(true);
          const res = await disableTwoFactor(token, password, code);
          setBusy(false);
          if (res.ok) void reload();
          return res;
        }}
      />

      <ConfirmActionModal
        open={transferModal}
        title="Transfer ownership"
        description={`Nominate a new owner for ${primaryVenue?.name ?? "this venue"}.`}
        confirmLabel="Submit transfer request"
        busy={busy}
        needsTwoFa={account?.twoFactor.enabled}
        emailField={{ label: "New owner email", placeholder: "owner@venue.com" }}
        onClose={() => setTransferModal(false)}
        onConfirm={async (password, twoFaCode, _reason, toEmail) => {
          if (!primaryVenue) return { ok: false, error: "not_venue_owner" };
          if (!toEmail?.trim()) return { ok: false, error: "email_required" };
          setBusy(true);
          const res = await requestOwnershipTransfer(token, {
            toEmail: toEmail.trim(),
            restaurantId: primaryVenue.id,
            password,
            twoFaCode
          });
          setBusy(false);
          return res.ok
            ? { ok: true, message: "Ownership transfer request submitted for review." }
            : { ok: false, error: res.error };
        }}
      />

      <ConfirmActionModal
        open={closureModal}
        title="Request account closure"
        description="Your request enters a cooling period before support review. Data is not deleted immediately."
        confirmLabel="Submit closure request"
        danger
        busy={busy}
        onClose={() => setClosureModal(false)}
        onConfirm={async (password, _code, reason) => {
          setBusy(true);
          const res = await requestAccountClosure(token, password, reason);
          setBusy(false);
          return res.ok
            ? { ok: true, message: "Closure request received. Check your email for next steps." }
            : { ok: false, error: res.error };
        }}
      />
    </AdminPanel>
  );
}
