import { AdminBtnPrimary, AdminInput, AdminLabel, subPanelCls } from "../AdminUi";
import { ProfileSectionCard, ProfileSectionFooter, ProfileSectionTitle } from "./ProfileUi";

export type PersonalInfoSnapshot = {
  fullName: string;
  phone: string;
  jobTitle: string;
};

type Props = {
  busy: boolean;
  saved: PersonalInfoSnapshot;
  fullName: string;
  phone: string;
  jobTitle: string;
  onFullNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onJobTitleChange: (v: string) => void;
  onSave: () => void;
};

function isDirty(current: PersonalInfoSnapshot, saved: PersonalInfoSnapshot) {
  return (
    current.fullName !== saved.fullName ||
    current.phone !== saved.phone ||
    current.jobTitle !== saved.jobTitle
  );
}

export function PersonalInfoCard({
  busy,
  saved,
  fullName,
  phone,
  jobTitle,
  onFullNameChange,
  onPhoneChange,
  onJobTitleChange,
  onSave
}: Props) {
  const current = { fullName, phone, jobTitle };
  const dirty = isDirty(current, saved);

  return (
    <div className={`${subPanelCls} admin-top-page-card admin-profile-editable-card xl:col-span-8`}>
      <ProfileSectionCard>
        <ProfileSectionTitle>Personal information</ProfileSectionTitle>
        <div className="admin-profile-section-body">
          <div className="admin-profile-editable-grid">
            <AdminLabel>
              Full name
              <AdminInput value={fullName} onChange={(e) => onFullNameChange(e.target.value)} />
            </AdminLabel>
            <AdminLabel>
              Phone
              <AdminInput
                type="tel"
                value={phone}
                onChange={(e) => onPhoneChange(e.target.value)}
                placeholder="+46 70 000 00 00"
              />
            </AdminLabel>
            <AdminLabel className="admin-profile-editable-span">
              Job title
              <AdminInput
                value={jobTitle}
                onChange={(e) => onJobTitleChange(e.target.value)}
                placeholder="Owner / General manager"
              />
            </AdminLabel>
          </div>
        </div>
        <ProfileSectionFooter>
          <AdminBtnPrimary
            className={`admin-profile-section-save${dirty ? " is-ready" : ""}`}
            disabled={busy || !dirty}
            onClick={onSave}
          >
            {busy ? "Saving…" : "Save profile"}
          </AdminBtnPrimary>
        </ProfileSectionFooter>
      </ProfileSectionCard>
    </div>
  );
}
