import { AdminBtnSecondary, subPanelCls } from "../AdminUi";
import type { UserSessionRow } from "./accountApi";
import { ProfileSectionCard, ProfileSectionFooter, ProfileSectionTitle } from "./ProfileUi";

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="admin-page-chip admin-page-chip--success">{children}</span>;
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

type Props = {
  sessions: UserSessionRow[];
  onManageSessions: () => void;
};

export function SessionsCard({ sessions, onManageSessions }: Props) {
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  return (
    <div className={`${subPanelCls} admin-top-page-card admin-profile-editable-card`}>
      <ProfileSectionCard>
        <ProfileSectionTitle>Sessions & devices</ProfileSectionTitle>
        <div className="admin-profile-section-body">
          <ul className="admin-profile-sessions-list">
            {sessions.length === 0 ? (
              <li className="admin-profile-sessions-empty">No active sessions recorded.</li>
            ) : (
              sessions.map((s) => (
                <li key={s.id} className="admin-session-row">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{s.deviceName}</p>
                    <p className="text-xs text-slate-500">
                      {s.browser}
                      {s.ipMasked ? ` · ${s.ipMasked}` : ""}
                      {s.location ? ` · ${s.location}` : ""}
                    </p>
                    <p className="text-[11px] text-slate-400">Last active {formatWhen(s.lastActiveAt)}</p>
                  </div>
                  {s.isCurrent ? <Chip>Current</Chip> : null}
                </li>
              ))
            )}
          </ul>
        </div>
        <ProfileSectionFooter>
          <AdminBtnSecondary disabled={otherSessions.length === 0} onClick={onManageSessions}>
            Sign out sessions
          </AdminBtnSecondary>
        </ProfileSectionFooter>
      </ProfileSectionCard>
    </div>
  );
}
