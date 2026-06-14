import { AdminBtnPrimary, subPanelCls } from "../AdminUi";
import { ProfileExclusiveToggleGroup } from "./ProfileExclusiveToggles";
import { ProfilePickDropdown } from "./ProfilePickDropdown";
import { ProfileSectionCard, ProfileSectionFooter, ProfileSectionTitle, ProfileToggleRow } from "./ProfileUi";
import {
  DATE_FORMAT_OPTIONS,
  LANGUAGE_OPTIONS,
  THEME_OPTIONS,
  TIMEZONE_OPTIONS
} from "./preferenceOptions";

export type AccountPrefsSnapshot = {
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  theme: string;
};

type Props = {
  busy: boolean;
  saved: AccountPrefsSnapshot;
  language: string;
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  theme: string;
  onLanguageChange: (v: string) => void;
  onTimezoneChange: (v: string) => void;
  onDateFormatChange: (v: string) => void;
  onTimeFormatChange: (v: "12h" | "24h") => void;
  onThemeChange: (v: "system" | "light" | "dark") => void;
  onSave: () => void;
};

function isDirty(current: AccountPrefsSnapshot, saved: AccountPrefsSnapshot) {
  return (
    current.language !== saved.language ||
    current.timezone !== saved.timezone ||
    current.dateFormat !== saved.dateFormat ||
    current.timeFormat !== saved.timeFormat ||
    current.theme !== saved.theme
  );
}

export function AccountPreferencesCard({
  busy,
  saved,
  language,
  timezone,
  dateFormat,
  timeFormat,
  theme,
  onLanguageChange,
  onTimezoneChange,
  onDateFormatChange,
  onTimeFormatChange,
  onThemeChange,
  onSave
}: Props) {
  const current = { language, timezone, dateFormat, timeFormat, theme };
  const dirty = isDirty(current, saved);

  return (
    <div className={`${subPanelCls} admin-top-page-card admin-profile-prefs-card admin-profile-editable-card`}>
      <ProfileSectionCard>
        <ProfileSectionTitle>Account preferences</ProfileSectionTitle>
        <div className="admin-profile-section-body">
          <div className="admin-profile-prefs-grid">
        <ProfilePickDropdown label="Language" value={language} options={LANGUAGE_OPTIONS} onChange={onLanguageChange} />
        <ProfilePickDropdown
          label="Timezone"
          value={timezone}
          options={TIMEZONE_OPTIONS}
          onChange={onTimezoneChange}
          searchable
          searchPlaceholder="Search timezones…"
        />
        <ProfilePickDropdown
          label="Date format"
          value={dateFormat}
          options={DATE_FORMAT_OPTIONS}
          onChange={onDateFormatChange}
        />
        <div className="admin-profile-pref-toggle-field">
          <span className="admin-profile-pick-label">Time format</span>
          <ProfileToggleRow
            label="24-hour clock"
            checked={timeFormat === "24h"}
            onChange={(on) => onTimeFormatChange(on ? "24h" : "12h")}
          />
        </div>
        <div className="admin-profile-pref-toggle-field admin-profile-pref-toggle-field--wide">
          <span className="admin-profile-pick-label">Theme</span>
          <ProfileExclusiveToggleGroup
            value={theme as "system" | "light" | "dark"}
            options={THEME_OPTIONS}
            onChange={onThemeChange}
          />
        </div>
          </div>
        </div>
        <ProfileSectionFooter>
          <AdminBtnPrimary
            className={`admin-profile-section-save${dirty ? " is-ready" : ""}`}
            disabled={busy || !dirty}
            onClick={onSave}
          >
            {busy ? "Saving…" : "Save preferences"}
          </AdminBtnPrimary>
        </ProfileSectionFooter>
      </ProfileSectionCard>
    </div>
  );
}
