import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  AdminBtnPrimary,
  AdminBtnSecondary,
  AdminInput,
  AdminLabel,
  AdminPanel,
  AdminSectionHeader,
  subPanelCls
} from "./AdminUi";
import { ADMIN_TOP_HASHES } from "./adminTopHashes";
import { ProfileModalShell } from "./profile/ProfileModalShell";
import { useAdminToast } from "./AdminToast";
import { AdminBubbleDropdown } from "./AdminBubbleDropdown";
import { AdminNavChevron } from "./AdminNavChevron";
import {
  CancelInviteConfirmModal,
  InviteDiscardModal,
  SendInviteConfirmModal,
  StaffSecurityActionModal,
  StaffUnsavedChangesModal,
  type StaffSecurityAction
} from "./StaffProfileModals";
import { useStaffManagement } from "./useStaffManagement";
import { mapStaffApiError } from "./staffApi";
import type { MemberStatus, PendingInvite, PresenceStatus, StaffMember, StaffRole } from "./staffMappers";

const ROLE_STYLES: Record<StaffRole, string> = {
  STAFF: "admin-staff-role--staff",
  KITCHEN: "admin-staff-role--kitchen",
  CASHIER: "admin-staff-role--cashier",
  MANAGER: "admin-staff-role--manager",
  OWNER: "admin-staff-role--manager"
};

const PRESENCE_LABEL: Record<PresenceStatus, string> = {
  on_shift: "On shift",
  online: "Online",
  idle: "Idle",
  offline: "Offline",
  suspended: "Suspended",
  pending: "Pending"
};

const ROLE_TEMPLATES = [
  {
    role: "STAFF",
    label: "Floor staff",
    preset: "Orders, tables, guest messaging",
    summary: "Front-of-house access for seating guests, running orders, and guest chat.",
    defaults: ["Orders", "Tables", "Reservations"],
    access: ["Take and update orders", "Manage table map", "Reply to guest messages", "View reservations"]
  },
  {
    role: "KITCHEN",
    label: "Kitchen",
    preset: "KDS, ticket status — no payments",
    summary: "Back-of-house ticket flow without cashier or analytics access.",
    defaults: ["Kitchen", "Order status"],
    access: ["Kitchen display tickets", "Mark items ready", "Update order status", "No payment visibility"]
  },
  {
    role: "CASHIER",
    label: "Cashier",
    preset: "Checkout and handoff",
    summary: "Counter checkout with read-only order context.",
    defaults: ["Checkout", "Orders (read)"],
    access: ["Process payments", "Read order details", "Hand off to floor", "No menu editing"]
  },
  {
    role: "MANAGER",
    label: "Venue manager",
    preset: "Full venue ops — analytics optional",
    summary: "Operational control across floor, kitchen, staff, and menu.",
    defaults: ["Orders", "Kitchen", "Staff", "Menu"],
    access: ["All floor + kitchen tools", "Staff permissions", "Menu management", "Optional analytics"]
  }
] as const;

type StaffFilter = "all" | "on_shift" | "pending" | "suspended";

const STAFF_FILTER_TABS: ReadonlyArray<{ key: StaffFilter; label: string }> = [
  { key: "all", label: "All staff" },
  { key: "on_shift", label: "On shift" },
  { key: "pending", label: "Pending" },
  { key: "suspended", label: "Suspended" }
];

const FILTER_TRANSITION = { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const };

type InviteForm = {
  fullName: string;
  email: string;
  phone: string;
  role: StaffRole;
  venue: string;
  shift: string;
};

const EMPTY_INVITE_FORM: InviteForm = {
  fullName: "",
  email: "",
  phone: "",
  role: "STAFF",
  venue: "current",
  shift: ""
};

const INVITE_ROLE_OPTIONS = [
  { value: "STAFF", label: "Floor staff (STAFF)", hint: "Orders, tables, guest messaging" },
  { value: "KITCHEN", label: "Kitchen (KITCHEN)", hint: "KDS and ticket status only" },
  { value: "CASHIER", label: "Cashier (CASHIER)", hint: "Checkout and order handoff" },
  { value: "MANAGER", label: "Venue manager (MANAGER)", hint: "Full venue operations" }
] as const;

const INVITE_VENUE_OPTIONS = [
  { value: "current", label: "Active venue only", hint: "Current restaurant in workspace" },
  { value: "all", label: "All venues in workspace", hint: "Every location you manage" },
  { value: "stockholm", label: "Stockholm Main", hint: "Single venue assignment" },
  { value: "soder", label: "Södermalm Pop-up", hint: "Single venue assignment" }
] as const;

const INVITE_SHIFT_OPTIONS = [
  { value: "", label: "No shift — assign later", hint: "Schedule after they join" },
  { value: "floor-am", label: "Floor · morning", hint: "Typically open – 14:00" },
  { value: "kitchen-pm", label: "Kitchen · evening", hint: "Typically 14:00 – close" }
] as const;

function isInviteDirty(form: InviteForm) {
  return (
    form.fullName.trim() !== EMPTY_INVITE_FORM.fullName ||
    form.email.trim() !== EMPTY_INVITE_FORM.email ||
    form.phone.trim() !== EMPTY_INVITE_FORM.phone ||
    form.role !== EMPTY_INVITE_FORM.role ||
    form.venue !== EMPTY_INVITE_FORM.venue ||
    form.shift !== EMPTY_INVITE_FORM.shift
  );
}

function validateInviteForm(form: InviteForm) {
  const errors: Partial<Record<keyof InviteForm, string>> = {};
  if (!form.fullName.trim()) errors.fullName = "Enter the staff member's full name.";
  if (!form.email.trim()) {
    errors.email = "Email is required for the invite.";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Enter a valid email address.";
  }
  if (!form.role) errors.role = "Choose a role template.";
  if (!form.venue) errors.venue = "Choose a venue assignment.";
  return errors;
}

function StaffFilterTabs({
  filter,
  onChange
}: {
  filter: StaffFilter;
  onChange: (next: StaffFilter) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<StaffFilter, HTMLButtonElement>>>({});
  const [indicator, setIndicator] = useState({ width: 0, left: 0 });

  useEffect(() => {
    const track = trackRef.current;
    const tab = tabRefs.current[filter];
    if (!track || !tab) return;
    const trackRect = track.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    setIndicator({
      width: tabRect.width,
      left: tabRect.left - trackRect.left
    });
  }, [filter]);

  useEffect(() => {
    const onResize = () => {
      const track = trackRef.current;
      const tab = tabRefs.current[filter];
      if (!track || !tab) return;
      const trackRect = track.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      setIndicator({
        width: tabRect.width,
        left: tabRect.left - trackRect.left
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [filter]);

  return (
    <div className="admin-staff-filter-tabs mt-8">
      <div ref={trackRef} className="admin-staff-filter-tabs-track" role="tablist" aria-label="Staff filters">
        <span
          className="admin-staff-filter-indicator"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          aria-hidden
        />
        {STAFF_FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el ?? undefined;
            }}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`admin-staff-filter-tab ${filter === key ? "admin-staff-filter-tab--active" : ""}`}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="admin-stat-card rounded-xl border p-4 shadow-sm">
      <p className="admin-stat-label text-[10px] font-bold uppercase tracking-[0.14em]">{label}</p>
      <p className="admin-stat-value mt-2 font-display text-2xl font-bold">{value}</p>
      {hint ? <p className="admin-stat-hint mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function PresenceDot({ status }: { status: PresenceStatus }) {
  return <span className={`admin-staff-presence admin-staff-presence--${status}`} aria-hidden />;
}

function RoleBadge({ role }: { role: StaffRole }) {
  return <span className={`admin-staff-role-badge ${ROLE_STYLES[role]}`}>{role}</span>;
}

function StaffAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="admin-staff-avatar" aria-hidden>
      {initials}
    </span>
  );
}

function ActionsMenu({
  member,
  open,
  onToggle,
  onAction
}: {
  member: StaffMember;
  open: boolean;
  onToggle: () => void;
  onAction: (action: string, blockedReason?: string | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);

  const caps = member.capabilities?.actions;
  const items = useMemo(() => {
    if (!caps) return [{ id: "profile", label: "View profile" }];
    const list: Array<{ id: string; label: string; danger?: boolean; blockedReason?: string | null }> = [
      { id: "profile", label: "View profile" }
    ];
    if (caps.permissions?.allowed) {
      list.push({ id: "permissions", label: "Edit permissions" });
    }
    if (member.memberStatus === "pending_approval") {
      list.push({
        id: "approve",
        label: "Approve access",
        blockedReason: caps.approve?.allowed ? null : caps.approve?.reason
      });
    }
    if (member.memberStatus === "suspended") {
      list.push({
        id: "activate",
        label: "Activate access",
        blockedReason: caps.activate?.allowed ? null : caps.activate?.reason
      });
    } else if (member.memberStatus === "active") {
      list.push({
        id: "suspend",
        label: "Suspend access",
        blockedReason: caps.suspend?.allowed ? null : caps.suspend?.reason
      });
    }
    list.push({
      id: "remove",
      label: "Remove access",
      danger: true,
      blockedReason: caps.remove?.allowed ? null : caps.remove?.reason
    });
    return list.filter((item) => item.id === "profile" || !item.blockedReason);
  }, [caps, member.memberStatus]);

  const updatePosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.bottom + 6,
      right: Math.max(12, window.innerWidth - rect.right)
    });
  };

  const cancelClose = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    if (!open) return;
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => onToggle(), 150);
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    const onLayout = () => updatePosition();
    window.addEventListener("resize", onLayout);
    window.addEventListener("scroll", onLayout, true);
    return () => {
      window.removeEventListener("resize", onLayout);
      window.removeEventListener("scroll", onLayout, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onToggle();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onToggle]);

  useEffect(() => {
    return () => cancelClose();
  }, []);

  return (
    <>
      <div
        className="admin-staff-actions"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <button
          ref={triggerRef}
          type="button"
          className={`admin-staff-actions-trigger${open ? " is-open" : ""}`}
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        >
          ⋯
        </button>
      </div>

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              className="admin-staff-actions-portal"
              style={{ top: coords.top, right: coords.right }}
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              <div
                className="admin-top-bubble admin-top-bubble--arrow-end admin-staff-actions-bubble"
                role="menu"
                aria-label={`Actions for ${member.name}`}
              >
                <div className="admin-bubble-header">
                  <p className="admin-bubble-title">{member.name}</p>
                  <p className="admin-bubble-desc">Staff actions</p>
                </div>
                <div className="admin-bubble-body admin-bubble-body--menu">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={`admin-bubble-menu-item w-full text-left${item.danger ? " admin-bubble-menu-item--danger" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggle();
                        onAction(item.id);
                      }}
                    >
                      <span className="admin-bubble-item-title">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

function permissionsSectionHint(member: StaffMember, permissionsReadOnly: boolean): ReactNode {
  if (member.role === "OWNER") {
    return "Owners have full venue access. Owner permissions are protected and cannot be changed from Staff Management.";
  }
  if (permissionsReadOnly && member.capabilities?.isSelf) {
    return "You cannot change your own permissions here. Ask another owner or manager if your access needs updating.";
  }
  if (permissionsReadOnly) {
    return member.capabilities?.readOnlyReason ?? "These permissions are read-only and cannot be edited.";
  }
  return (
    <>
      Role <strong>{member.roleTemplate}</strong> is a preset — toggles override the template per person.
    </>
  );
}

function PermissionToggle({
  label,
  enabled,
  disabled,
  disabledReason,
  onChange
}: {
  label: string;
  enabled: boolean;
  disabled?: boolean;
  disabledReason?: string | null;
  onChange?: (v: boolean) => void;
}) {
  return (
    <label
      className={`admin-staff-perm-row${disabled ? " admin-staff-perm-row--readonly admin-staff-perm-row--locked" : ""}`}
      title={disabled ? disabledReason ?? undefined : undefined}
      aria-disabled={disabled || undefined}
    >
      <span className="admin-staff-perm-label">{label}</span>
      <span className={`admin-profile-toggle${disabled ? " admin-profile-toggle--locked" : ""}`}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => {
            if (!disabled) onChange?.(e.target.checked);
          }}
        />
        <span className="admin-profile-toggle-track" aria-hidden />
      </span>
    </label>
  );
}

function permissionsEqual(
  a: StaffMember["permissionGroups"],
  b: StaffMember["permissionGroups"]
) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function StaffProfileDrawer({
  member,
  open,
  onClose,
  permissions,
  onPermissionChange,
  dirty,
  saving,
  onSave,
  onDiscard,
  onSecurityAction
}: {
  member: StaffMember | null;
  open: boolean;
  onClose: () => void;
  permissions: StaffMember["permissionGroups"];
  onPermissionChange: (id: string, enabled: boolean) => void;
  dirty: boolean;
  saving: boolean;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  onSecurityAction: (
    action: StaffSecurityAction,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { pushToast } = useAdminToast();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activeMember, setActiveMember] = useState<StaffMember | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [securityAction, setSecurityAction] = useState<StaffSecurityAction | null>(null);
  const [securityBusy, setSecurityBusy] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const finishClose = () => {
    setUnsavedOpen(false);
    setSecurityAction(null);
    onClose();
  };

  const attemptClose = () => {
    if (securityAction) {
      if (!securityBusy) setSecurityAction(null);
      return;
    }
    if (unsavedOpen) {
      if (!saving) setUnsavedOpen(false);
      return;
    }
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    finishClose();
  };

  const handleDiscardAndClose = () => {
    onDiscard();
    finishClose();
  };

  const handleSaveFromPrompt = async () => {
    const ok = await onSave();
    if (ok) finishClose();
  };

  const runSecurityAction = async (password: string) => {
    if (!activeMember || !securityAction) return { ok: false as const, error: "No staff member selected." };
    if (!password.trim()) return { ok: false as const, error: "Enter your password to continue." };

    setSecurityBusy(true);
    const res = await onSecurityAction(securityAction, password);
    setSecurityBusy(false);
    if (!res.ok) return res;

    const labels: Record<StaffSecurityAction, string> = {
      reset_password: `Password reset link sent to ${activeMember.email}.`,
      force_logout: `${activeMember.name} was signed out on all devices.`,
      revoke_sessions: `All sessions for ${activeMember.name} were revoked.`
    };

    setSecurityAction(null);
    pushToast(labels[securityAction], "success");
    return { ok: true as const };
  };

  useEffect(() => {
    if (!open) {
      setUnsavedOpen(false);
      setSecurityAction(null);
    }
  }, [open]);

  useEffect(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (open && member) {
      setActiveMember(member);
      setMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setVisible(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setMounted(false);
      setActiveMember(null);
      closeTimerRef.current = null;
    }, 520);

    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, member]);

  useEffect(() => {
    if (open && member) setActiveMember(member);
  }, [open, member]);

  useEffect(() => {
    if (!visible) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") attemptClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, dirty, unsavedOpen, securityAction, securityBusy, saving]);

  if (!mounted || !activeMember) return null;

  const permissionsReadOnly = activeMember.capabilities?.permissionsReadOnly ?? false;
  const readOnlyReason = activeMember.capabilities?.readOnlyReason ?? null;
  const canSavePermissions = activeMember.capabilities?.canSavePermissions ?? !permissionsReadOnly;
  const securityCaps = activeMember.capabilities?.actions;

  const securityButton = (
    action: StaffSecurityAction,
    label: string,
    variant: "secondary" | "danger" = "secondary"
  ) => {
    const capKey = action === "force_logout" ? "force_logout" : action;
    const cap = securityCaps?.[capKey];
    const allowed = cap?.allowed !== false;
    const onClick = () => {
      if (!allowed) {
        pushToast(cap?.reason ?? "This action is not allowed.", "error");
        return;
      }
      setSecurityAction(action);
    };
    if (variant === "danger") {
      return (
        <button
          type="button"
          className="admin-staff-danger-btn"
          disabled={!allowed}
          title={!allowed ? cap?.reason ?? undefined : undefined}
          onClick={onClick}
        >
          {label}
        </button>
      );
    }
    return (
      <AdminBtnSecondary disabled={!allowed} title={!allowed ? cap?.reason ?? undefined : undefined} onClick={onClick}>
        {label}
      </AdminBtnSecondary>
    );
  };

  return createPortal(
    <>
      <div
        className={`admin-staff-profile-shell ${visible ? "admin-staff-profile-shell--open" : ""}`}
        role="presentation"
        aria-hidden={!visible}
      >
        <button
          type="button"
          className="admin-staff-profile-backdrop"
          aria-label="Close staff profile"
          tabIndex={visible ? 0 : -1}
          onClick={attemptClose}
        />

        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${activeMember.name} profile`}
          className={`admin-staff-profile-panel ${visible ? "admin-staff-profile-panel--open" : ""}`}
        >
        <header className="admin-staff-profile-header">
          <div className="flex items-start gap-3">
            <StaffAvatar name={activeMember.name} />
            <div className="min-w-0 flex-1">
              <h3 className="admin-staff-profile-title">{activeMember.name}</h3>
              <p className="admin-staff-profile-sub">{activeMember.email}</p>
              {activeMember.phone ? <p className="admin-staff-profile-meta">{activeMember.phone}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RoleBadge role={activeMember.role} />
                <span className="admin-staff-presence-pill">
                  <PresenceDot status={activeMember.presence} />
                  {PRESENCE_LABEL[activeMember.presence]}
                </span>
              </div>
            </div>
          </div>
          <button type="button" className="admin-staff-profile-close" onClick={attemptClose} aria-label="Close">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="admin-staff-profile-body">
          <section
            className={`admin-staff-drawer-section${permissionsReadOnly ? " admin-staff-drawer-section--permissions-locked" : ""}`}
          >
            <h4 className="admin-staff-drawer-section-title">
              Permissions
              {permissionsReadOnly ? (
                <span className="admin-staff-perm-lock-pill">Read-only</span>
              ) : null}
            </h4>
            <p
              className={`admin-staff-drawer-hint${permissionsReadOnly ? " admin-staff-drawer-hint--locked" : ""}`}
              role={permissionsReadOnly ? "status" : undefined}
            >
              {permissionsSectionHint(activeMember, permissionsReadOnly)}
            </p>
            <div
              className={`admin-staff-perm-list${permissionsReadOnly ? " admin-staff-perm-list--locked" : ""}`}
              aria-label={permissionsReadOnly ? "Permissions (read-only)" : "Permissions"}
            >
              {permissions.length ? (
                permissions.map((g) => (
                  <PermissionToggle
                    key={g.id}
                    label={g.label}
                    enabled={g.enabled}
                    disabled={permissionsReadOnly}
                    disabledReason={readOnlyReason}
                    onChange={(v) => onPermissionChange(g.id, v)}
                  />
                ))
              ) : (
                <p className="admin-staff-profile-muted">No permissions until invite is accepted and approved.</p>
              )}
            </div>
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Shift & activity</h4>
            <dl className="admin-staff-meta-grid">
              <div>
                <dt>Status</dt>
                <dd>{PRESENCE_LABEL[activeMember.presence]}</dd>
              </div>
              <div>
                <dt>Current shift</dt>
                <dd>{activeMember.currentShift ?? "—"}</dd>
              </div>
              <div>
                <dt>Last active</dt>
                <dd>{activeMember.lastActive}</dd>
              </div>
              <div>
                <dt>Locations</dt>
                <dd>{activeMember.venues.join(", ")}</dd>
              </div>
            </dl>
            {activeMember.lastActive ? (
              <p className="admin-staff-last-action">
                <span className="admin-staff-live-tag">Activity</span> Last seen {activeMember.lastActive}
              </p>
            ) : null}
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Devices</h4>
            {activeMember.devices.length ? (
              <ul className="admin-staff-device-list">
                {activeMember.devices.map((d) => (
                  <li key={d.label}>
                    <span className="font-semibold">{d.label}</span>
                    <span className="admin-staff-profile-muted">{d.type} · {d.lastSeen}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-staff-profile-muted">No devices registered yet.</p>
            )}
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title">Login sessions</h4>
            {activeMember.sessions.length ? (
              <ul className="admin-staff-session-list">
                {activeMember.sessions.map((s) => (
                  <li key={s.device} className={s.current ? "admin-staff-session--current" : ""}>
                    <p className="font-semibold">{s.device}</p>
                    <p className="admin-staff-profile-muted">
                      {s.location} · {s.lastActive}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="admin-staff-profile-muted">No active sessions.</p>
            )}
          </section>

          <section className="admin-staff-drawer-section">
            <h4 className="admin-staff-drawer-section-title admin-staff-drawer-section-title--danger">Security</h4>
            <div className="flex flex-wrap gap-2">
              {securityButton("reset_password", "Reset password")}
              {securityButton("force_logout", "Force logout")}
              {securityButton("revoke_sessions", "Revoke all sessions", "danger")}
            </div>
            {dirty && canSavePermissions ? (
              <div className="admin-staff-save-row">
                <p className="admin-staff-save-hint">You have unsaved permission changes.</p>
                <AdminBtnPrimary
                  disabled={saving}
                  onClick={async () => {
                    const ok = await onSave();
                    if (!ok) return;
                  }}
                >
                  {saving ? "Saving…" : "Save changes"}
                </AdminBtnPrimary>
              </div>
            ) : null}
          </section>
        </div>
      </div>
      </div>

      <StaffSecurityActionModal
        open={Boolean(securityAction)}
        action={securityAction}
        staffName={activeMember.name}
        staffEmail={activeMember.email}
        busy={securityBusy}
        onClose={() => {
          if (securityBusy) return;
          setSecurityAction(null);
        }}
        onConfirm={runSecurityAction}
      />

      <StaffUnsavedChangesModal
        open={unsavedOpen}
        staffName={activeMember.name}
        busy={saving}
        onStay={() => {
          if (saving) return;
          setUnsavedOpen(false);
        }}
        onDiscard={handleDiscardAndClose}
        onSave={() => void handleSaveFromPrompt()}
      />
    </>,
    document.body
  );
}

function InviteStaffModal({
  open,
  onClose,
  onSent,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSent: (name: string) => void;
  onSubmit: (input: { fullName: string; email: string; phone?: string; role: string }) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [form, setForm] = useState<InviteForm>(EMPTY_INVITE_FORM);
  const [touched, setTouched] = useState<Partial<Record<keyof InviteForm, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [sending, setSending] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [shakeSubmit, setShakeSubmit] = useState(false);

  const errors = useMemo(() => validateInviteForm(form), [form]);
  const hasErrors = Object.keys(errors).length > 0;
  const dirty = isInviteDirty(form);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_INVITE_FORM);
      setTouched({});
      setSubmitAttempted(false);
      setSending(false);
      setDiscardOpen(false);
      setConfirmOpen(false);
      setShakeSubmit(false);
    }
  }, [open]);

  const patch = (key: keyof InviteForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const attemptClose = () => {
    if (sending) return;
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  };

  const finishClose = () => {
    setDiscardOpen(false);
    setForm(EMPTY_INVITE_FORM);
    setTouched({});
    setSubmitAttempted(false);
    onClose();
  };

  const fieldClass = (key: keyof InviteForm) => {
    const showError = (touched[key] || submitAttempted) && errors[key];
    const showOk = (touched[key] || submitAttempted) && !errors[key] && String(form[key]).trim();
    return [
      showError ? "admin-staff-field--error" : "",
      showOk ? "admin-staff-field--ok" : ""
    ]
      .filter(Boolean)
      .join(" ");
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSend = () => {
    setSubmitAttempted(true);
    const nextErrors = validateInviteForm(form);
    if (Object.keys(nextErrors).length > 0) {
      setShakeSubmit(true);
      window.setTimeout(() => setShakeSubmit(false), 520);
      return;
    }
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const confirmSend = async () => {
    setSending(true);
    setSubmitError(null);
    const res = await onSubmit({
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      role: form.role
    });
    setSending(false);
    if (!res.ok) {
      setSubmitError(res.error ?? "Could not send invite.");
      return;
    }
    setConfirmOpen(false);
    onSent(form.fullName.trim());
    finishClose();
  };

  const roleLabel = INVITE_ROLE_OPTIONS.find((o) => o.value === form.role)?.label ?? form.role;

  const submitTone =
    submitAttempted && hasErrors
      ? "admin-staff-invite-submit--error"
      : !hasErrors && form.fullName.trim() && form.email.trim()
        ? "admin-staff-invite-submit--ready"
        : "";

  return (
    <>
      <ProfileModalShell
        open={open}
        onClose={attemptClose}
        title="Invite staff"
        description="Add a team member — they receive an invite to accept and get manager approval."
        titleId="invite-staff-title"
        maxWidthClass="max-w-none"
        maxHeightClass="admin-staff-invite-modal-max-h"
        panelClassName="admin-staff-invite-modal"
        bodyClassName="admin-staff-invite-modal-body"
        bodyScroll={false}
        busy={sending}
      >
        <div className="admin-staff-invite-form">
          <div className="admin-staff-invite-form__identity">
            <AdminLabel className={fieldClass("fullName")}>
              <span className="admin-staff-field-label">
                Full name <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input"
                placeholder="First and last name"
                autoComplete="off"
                value={form.fullName}
                onChange={(e) => patch("fullName", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, fullName: true }))}
                aria-invalid={Boolean(errors.fullName) || undefined}
              />
              {(touched.fullName || submitAttempted) && errors.fullName ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.fullName}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("email")}>
              <span className="admin-staff-field-label">
                Email <span className="admin-staff-field-required">*</span>
              </span>
              <AdminInput
                className="admin-staff-premium-input"
                type="email"
                placeholder="name@restaurant.com"
                autoComplete="off"
                value={form.email}
                onChange={(e) => patch("email", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                aria-invalid={Boolean(errors.email) || undefined}
              />
              {(touched.email || submitAttempted) && errors.email ? (
                <span className="admin-staff-field-error" role="alert">
                  {errors.email}
                </span>
              ) : null}
            </AdminLabel>

            <AdminLabel className={fieldClass("phone")}>
              <span className="admin-staff-field-label">Phone (optional)</span>
              <AdminInput
                className="admin-staff-premium-input"
                type="tel"
                placeholder="+46 …"
                autoComplete="off"
                value={form.phone}
                onChange={(e) => patch("phone", e.target.value)}
                onBlur={() => setTouched((p) => ({ ...p, phone: true }))}
              />
            </AdminLabel>
          </div>

          <div className="admin-staff-invite-form__assignments">
            <div className={fieldClass("role")}>
              <AdminBubbleDropdown
                label="Role template"
                required
                dropInline
                value={form.role}
                options={[...INVITE_ROLE_OPTIONS]}
                onChange={(v) => patch("role", v)}
                onBlur={() => setTouched((p) => ({ ...p, role: true }))}
              />
            </div>

            <div className={fieldClass("venue")}>
              <AdminBubbleDropdown
                label="Venue assignment"
                required
                dropInline
                value={form.venue}
                options={[...INVITE_VENUE_OPTIONS]}
                onChange={(v) => patch("venue", v)}
                onBlur={() => setTouched((p) => ({ ...p, venue: true }))}
              />
            </div>

            <div className={fieldClass("shift")}>
              <AdminBubbleDropdown
                label="Shift assignment"
                dropInline
                value={form.shift}
                options={[...INVITE_SHIFT_OPTIONS]}
                onChange={(v) => patch("shift", v)}
                onBlur={() => setTouched((p) => ({ ...p, shift: true }))}
              />
            </div>
          </div>
        </div>

        {submitAttempted && hasErrors ? (
          <p className="admin-staff-invite-form-alert" role="alert">
            Complete the required fields before sending the invite.
          </p>
        ) : null}
        {submitError ? (
          <p className="admin-staff-invite-form-alert" role="alert">
            {submitError}
          </p>
        ) : null}

        <div className="admin-staff-invite-footer mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <AdminBtnSecondary onClick={attemptClose} disabled={sending}>
            Cancel
          </AdminBtnSecondary>
          <button
            type="button"
            disabled={sending}
            onClick={() => handleSend()}
            className={`admin-staff-invite-submit ${submitTone} ${shakeSubmit ? "admin-staff-invite-submit--shake" : ""}`}
          >
            {sending ? "Sending…" : "Send invite"}
          </button>
        </div>
      </ProfileModalShell>

      <InviteDiscardModal
        open={discardOpen}
        onStay={() => setDiscardOpen(false)}
        onDiscard={finishClose}
      />

      <SendInviteConfirmModal
        open={confirmOpen}
        fullName={form.fullName.trim()}
        email={form.email.trim()}
        roleLabel={roleLabel}
        busy={sending}
        error={submitError}
        onCancel={() => {
          if (sending) return;
          setConfirmOpen(false);
          setSubmitError(null);
        }}
        onConfirm={() => void confirmSend()}
      />
    </>
  );
}

function RoleTemplateCard({ template }: { template: (typeof ROLE_TEMPLATES)[number] }) {
  return (
    <li className="admin-role-template-card">
      <div className="admin-role-template-card__head">
        <div className="flex flex-wrap items-center gap-2">
          <RoleBadge role={template.role} />
          <span className="text-sm font-bold admin-staff-text">{template.label}</span>
        </div>
        <span className="admin-role-template-card__chevron" aria-hidden>
          <AdminNavChevron open={false} className="admin-role-template-card__chevron-icon" />
        </span>
      </div>
      <div className="admin-role-template-card__body">
        <p className="admin-role-template-card__summary">{template.summary}</p>
        <p className="admin-role-template-card__preset">{template.preset}</p>
        <ul className="admin-role-template-card__access">
          {template.access.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p className="admin-role-template-card__defaults">
          Default areas: {template.defaults.join(" · ")}
        </p>
      </div>
    </li>
  );
}

function RoleTemplatesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ProfileModalShell
      open={open}
      onClose={onClose}
      title="Role templates"
      description="Hover a template to preview permissions — each person can still be customized."
      titleId="role-templates-title"
      maxWidthClass="max-w-lg"
      panelClassName="admin-staff-roles-modal"
    >
      <ul className="admin-role-template-list space-y-3">
        {ROLE_TEMPLATES.map((t) => (
          <RoleTemplateCard key={t.role} template={t} />
        ))}
      </ul>
      <div className="mt-6 flex justify-end">
        <AdminBtnPrimary onClick={onClose}>Done</AdminBtnPrimary>
      </div>
    </ProfileModalShell>
  );
}

export function AdminStaffManagementPage({
  token,
  restaurantId,
  venueName
}: {
  token: string | null;
  restaurantId: string;
  venueName: string;
}) {
  const { pushToast } = useAdminToast();
  const {
    loading,
    error,
    staff,
    pendingInvites,
    stats,
    loadMemberDetail,
    sendInvite,
    cancelInvite,
    savePermissions,
    runMembershipAction,
    runSecurityAction
  } = useStaffManagement(token, restaurantId, venueName);

  const [filter, setFilter] = useState<StaffFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [permOverrides, setPermOverrides] = useState<Record<string, StaffMember["permissionGroups"]>>({});
  const [permBaselines, setPermBaselines] = useState<Record<string, StaffMember["permissionGroups"]>>({});
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [drawerMember, setDrawerMember] = useState<StaffMember | null>(null);
  const [cancelInviteTarget, setCancelInviteTarget] = useState<PendingInvite | null>(null);
  const [cancelInviteBusy, setCancelInviteBusy] = useState(false);
  const [cancelInviteError, setCancelInviteError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "on_shift") return staff.filter((s) => s.presence === "on_shift");
    if (filter === "pending")
      return staff.filter((s) => s.memberStatus === "pending_invite" || s.memberStatus === "pending_approval");
    if (filter === "suspended") return staff.filter((s) => s.memberStatus === "suspended");
    return staff;
  }, [filter, staff]);

  const selected = staff.find((s) => s.id === selectedId) ?? null;
  const displayMember =
    drawerMember && selectedId && drawerMember.id === selectedId ? drawerMember : selected;
  const permissionBaseline = displayMember
    ? permBaselines[displayMember.id] ?? displayMember.permissionGroups
    : [];
  const drawerPermissions = displayMember ? permOverrides[displayMember.id] ?? permissionBaseline : [];
  const permissionsDirty = displayMember ? !permissionsEqual(permissionBaseline, drawerPermissions) : false;

  const openDrawer = async (member: StaffMember) => {
    setSelectedId(member.id);
    setDrawerMember(member);
    setDrawerOpen(true);
    setOpenMenuId(null);
    const detail = await loadMemberDetail(member.id);
    if (detail) {
      setDrawerMember(detail);
      setPermBaselines((prev) => ({ ...prev, [detail.id]: detail.permissionGroups }));
    }
  };

  const handleMembershipMenuAction = async (member: StaffMember, action: string) => {
    if (action === "profile" || action === "permissions") {
      void openDrawer(member);
      return;
    }
    if (action === "suspend") {
      const res = await runMembershipAction("suspend", member.id);
      pushToast(res.ok ? `${member.name} suspended.` : res.error ?? "Could not suspend.", res.ok ? "success" : "error");
      return;
    }
    if (action === "activate") {
      const res = await runMembershipAction("activate", member.id);
      pushToast(res.ok ? `${member.name} reactivated.` : res.error ?? "Could not activate.", res.ok ? "success" : "error");
      return;
    }
    if (action === "remove") {
      const res = await runMembershipAction("remove", member.id);
      pushToast(res.ok ? `${member.name} removed.` : res.error ?? "Could not remove.", res.ok ? "success" : "error");
      if (res.ok && selectedId === member.id) setDrawerOpen(false);
      return;
    }
    if (action === "approve") {
      const res = await runMembershipAction("approve", member.id);
      pushToast(res.ok ? `${member.name} approved.` : res.error ?? "Could not approve.", res.ok ? "success" : "error");
    }
  };

  const handlePermissionChange = (groupId: string, enabled: boolean) => {
    if (!displayMember?.capabilities?.canEditPermissions) return;
    setPermOverrides((prev) => {
      const base = prev[displayMember.id] ?? permissionBaseline;
      return {
        ...prev,
        [displayMember.id]: base.map((g) => (g.id === groupId ? { ...g, enabled } : g))
      };
    });
  };

  const discardPermissionChanges = () => {
    if (!displayMember) return;
    setPermOverrides((prev) => {
      const next = { ...prev };
      delete next[displayMember.id];
      return next;
    });
  };

  const savePermissionChanges = async (): Promise<boolean> => {
    if (!displayMember) return false;
    if (!displayMember.capabilities?.canSavePermissions) {
      pushToast(displayMember.capabilities?.readOnlyReason ?? "You cannot edit these permissions.", "error");
      return false;
    }
    setSavingPermissions(true);
    try {
      const draft = permOverrides[displayMember.id] ?? permissionBaseline;
      const res = await savePermissions(displayMember.id, draft);
      if (!res.ok) {
        pushToast(res.error ?? "Could not save permissions.", "error");
        return false;
      }
      setPermBaselines((prev) => ({ ...prev, [displayMember.id]: draft }));
      setPermOverrides((prev) => {
        const next = { ...prev };
        delete next[displayMember.id];
        return next;
      });
      pushToast(`Permissions saved for ${displayMember.name}.`, "success");
      return true;
    } finally {
      setSavingPermissions(false);
    }
  };

  return (
    <>
      <AdminPanel id={ADMIN_TOP_HASHES.addStaff.slice(1)} className="admin-top-page admin-panel--edge admin-staff-page">
        <AdminSectionHeader
          eyebrowText="Workforce"
          title="Staff Management"
          action={
            <div className="flex flex-wrap gap-2">
              <AdminBtnSecondary onClick={() => setTemplatesOpen(true)}>Role templates</AdminBtnSecondary>
              <AdminBtnPrimary onClick={() => setInviteOpen(true)}>Invite staff</AdminBtnPrimary>
            </div>
          }
        />

        {!restaurantId ? (
          <p className="mt-6 text-sm admin-staff-text-muted">Select a venue to manage staff.</p>
        ) : error ? (
          <p className="mt-6 text-sm font-semibold text-rose-600" role="alert">
            {error}
          </p>
        ) : loading ? (
          <p className="mt-6 text-sm admin-staff-text-muted">Loading staff…</p>
        ) : (
          <>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Total staff" value={String(stats.total)} hint="Across assigned venues" />
          <StatTile label="Active today" value={String(stats.activeToday)} hint="Signed in last 24h" />
          <StatTile label="On shift now" value={String(stats.onShift)} hint="Clocked in" />
          <StatTile label="Pending invites" value={String(stats.pending)} hint="Awaiting acceptance" />
        </div>

        <StaffFilterTabs filter={filter} onChange={setFilter} />

        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            className="admin-staff-filter-view mt-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={FILTER_TRANSITION}
          >
            <div className={`${subPanelCls} admin-staff-section admin-staff-table-wrap overflow-hidden p-0`}>
              <div className="overflow-x-auto">
                <table className="admin-staff-table w-full min-w-[960px] text-left text-sm">
                  <thead>
                    <tr>
                      <th>Staff member</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Work info</th>
                      <th>Permissions</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length ? (
                      filtered.map((member) => (
                        <tr
                          key={member.id}
                          className="admin-staff-row"
                          onClick={() => openDrawer(member)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openDrawer(member);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <StaffAvatar name={member.name} />
                              <div className="min-w-0">
                                <p className="font-semibold admin-staff-text">{member.name}</p>
                                <p className="truncate text-xs admin-staff-text-muted">{member.email}</p>
                                {member.phone ? (
                                  <p className="text-xs admin-staff-text-subtle">{member.phone}</p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td>
                            <RoleBadge role={member.role} />
                            <p className="mt-1 text-xs admin-staff-text-muted">{member.roleTemplate}</p>
                          </td>
                          <td>
                            <span className="admin-staff-presence-pill">
                              <PresenceDot status={member.presence} />
                              {PRESENCE_LABEL[member.presence]}
                            </span>
                          </td>
                          <td>
                            <p className="text-xs font-semibold admin-staff-text">{member.venues.join(", ")}</p>
                            <p className="mt-0.5 text-xs admin-staff-text-muted">
                              {member.currentShift ?? "No active shift"}
                            </p>
                            <p className="mt-0.5 text-xs admin-staff-text-subtle">Last active {member.lastActive}</p>
                          </td>
                          <td>
                            <span className="admin-staff-perm-summary">{member.permissionSummary}</span>
                          </td>
                          <td className="text-right">
                            <ActionsMenu
                              member={member}
                              open={openMenuId === member.id}
                              onToggle={() => setOpenMenuId((id) => (id === member.id ? null : member.id))}
                              onAction={(action) => void handleMembershipMenuAction(member, action)}
                            />
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="admin-staff-filter-empty">
                          <p className="font-semibold admin-staff-text">No staff in this view</p>
                          <p className="mt-1 text-sm admin-staff-text-muted">
                            Try another filter or invite someone new.
                          </p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className={`${subPanelCls} admin-staff-section mt-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-wide admin-staff-text-muted">Pending invites</p>
            <AdminBtnSecondary onClick={() => setInviteOpen(true)}>New invite</AdminBtnSecondary>
          </div>
          {pendingInvites.length ? (
            <ul className="mt-4 space-y-2">
              {pendingInvites.map((inv) => (
                <li key={inv.id} className="admin-staff-invite-row flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <div>
                    <p className="font-semibold admin-staff-text">{inv.name}</p>
                    <p className="text-xs admin-staff-text-muted">
                      {inv.email} · {inv.venue}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RoleBadge role={inv.role} />
                    <span className="text-xs admin-staff-text-muted">Sent {inv.sent}</span>
                    <button
                      type="button"
                      className="admin-page-link-btn text-xs font-semibold"
                      onClick={() => {
                        setCancelInviteError(null);
                        setCancelInviteTarget(inv);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm admin-staff-text-muted">No pending invites.</p>
          )}
        </div>
          </>
        )}
      </AdminPanel>

      <StaffProfileDrawer
        member={displayMember}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setDrawerMember(null);
        }}
        permissions={drawerPermissions}
        onPermissionChange={handlePermissionChange}
        dirty={permissionsDirty}
        saving={savingPermissions}
        onSave={savePermissionChanges}
        onDiscard={discardPermissionChanges}
        onSecurityAction={(action, password) =>
          displayMember
            ? runSecurityAction(displayMember.id, action, password)
            : Promise.resolve({ ok: false, error: "No member selected." })
        }
      />

      <InviteStaffModal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={(name) => pushToast(`Invite sent to ${name}.`, "success")}
        onSubmit={sendInvite}
      />
      <RoleTemplatesModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />

      <CancelInviteConfirmModal
        open={cancelInviteTarget !== null}
        fullName={cancelInviteTarget?.name ?? ""}
        email={cancelInviteTarget?.email ?? ""}
        busy={cancelInviteBusy}
        error={cancelInviteError}
        onCancel={() => {
          if (cancelInviteBusy) return;
          setCancelInviteTarget(null);
          setCancelInviteError(null);
        }}
        onConfirm={() => {
          if (!cancelInviteTarget) return;
          void (async () => {
            setCancelInviteBusy(true);
            setCancelInviteError(null);
            const res = await cancelInvite(cancelInviteTarget.id);
            setCancelInviteBusy(false);
            if (!res.ok) {
              setCancelInviteError(res.error ? mapStaffApiError(res.error) : "Could not cancel invite.");
              return;
            }
            pushToast(`Invite for ${cancelInviteTarget.name} cancelled.`, "success");
            setCancelInviteTarget(null);
          })();
        }}
      />
    </>
  );
}
