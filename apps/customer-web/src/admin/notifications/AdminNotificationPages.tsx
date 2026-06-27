import { type ReactNode } from "react";
import { AdminBtnSecondary } from "../AdminUi";
import { isAdminNotificationPageHash } from "../adminTopHashes";
import {
  resolveNotificationCategory,
  type NotificationCategory,
  type NotificationLayout
} from "./notificationRouting";

function NotifyHero({ category }: { category: NotificationCategory }) {
  return (
    <header className={`admin-notify-hero admin-notify-hero--${category.accent}`}>
      <div className="admin-notify-hero-glow" aria-hidden />
      <div className="admin-notify-hero-inner">
        <p className="admin-notify-hero-eyebrow">{category.layout} channel</p>
        <h1 className="admin-notify-hero-title">{category.label}</h1>
        <p className="admin-notify-hero-desc">{category.description}</p>
      </div>
    </header>
  );
}

function RadarLayout() {
  return (
    <div className="admin-notify-radar">
      <div className="admin-notify-radar-core" aria-hidden>
        <span className="admin-notify-radar-ring admin-notify-radar-ring--1" />
        <span className="admin-notify-radar-ring admin-notify-radar-ring--2" />
        <span className="admin-notify-radar-ring admin-notify-radar-ring--3" />
        <span className="admin-notify-radar-dot" />
      </div>
      <div className="admin-notify-radar-feed">
        <p className="admin-notify-empty-title">No customer alerts right now</p>
        <p className="admin-notify-empty-desc">Guest-facing signals will pulse here when something needs your attention.</p>
      </div>
    </div>
  );
}

function ThreadsLayout() {
  return (
    <div className="admin-notify-threads">
      {[1, 2, 3].map((i) => (
        <div key={i} className={`admin-notify-thread admin-notify-thread--${i % 2 === 0 ? "right" : "left"}`}>
          <div className="admin-notify-thread-bubble admin-notify-thread-bubble--ghost" />
        </div>
      ))}
      <p className="admin-notify-threads-caption">Staff messages will appear as live conversation threads.</p>
    </div>
  );
}

function LedgerLayout() {
  return (
    <div className="admin-notify-ledger">
      <div className="admin-notify-ledger-head">
        <span>Timestamp</span>
        <span>Event</span>
        <span>Amount</span>
        <span>Status</span>
      </div>
      <div className="admin-notify-ledger-rows">
        {["—", "—", "—"].map((_, i) => (
          <div key={i} className="admin-notify-ledger-row admin-notify-ledger-row--ghost">
            <span>00:00</span>
            <span>Awaiting payment events</span>
            <span>—</span>
            <span className="admin-notify-ledger-pill">Idle</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MeshLayout() {
  const nodes = ["KDS", "POS", "Printer", "Network"];
  return (
    <div className="admin-notify-mesh">
      <svg className="admin-notify-mesh-lines" viewBox="0 0 400 220" aria-hidden>
        <line x1="200" y1="110" x2="80" y2="50" />
        <line x1="200" y1="110" x2="320" y2="50" />
        <line x1="200" y1="110" x2="80" y2="170" />
        <line x1="200" y1="110" x2="320" y2="170" />
      </svg>
      <div className="admin-notify-mesh-hub">Venue</div>
      {nodes.map((label, i) => (
        <div key={label} className={`admin-notify-mesh-node admin-notify-mesh-node--${i + 1}`}>
          <span className="admin-notify-mesh-node-dot" />
          {label}
        </div>
      ))}
      <p className="admin-notify-mesh-caption">Device health alerts map to each node when issues occur.</p>
    </div>
  );
}

function ConsoleLayout() {
  const lines = [
    "> serveos.audit — waiting for stream…",
    "> venue.scope — all locations",
    "> retention — 90 days",
    "—",
    "No log entries yet. Operational events will stream here."
  ];
  return (
    <div className="admin-notify-console">
      <div className="admin-notify-console-bar">
        <span className="admin-notify-console-dot admin-notify-console-dot--red" />
        <span className="admin-notify-console-dot admin-notify-console-dot--amber" />
        <span className="admin-notify-console-dot admin-notify-console-dot--green" />
        <span className="admin-notify-console-title">venue-logs — live tail</span>
      </div>
      <pre className="admin-notify-console-body">
        {lines.map((line) => (
          <code key={line}>{line}</code>
        ))}
      </pre>
    </div>
  );
}

function TimelineLayout() {
  return (
    <div className="admin-notify-timeline">
      {["Platform", "Maintenance", "Policy"].map((tag, i) => (
        <article key={tag} className="admin-notify-timeline-card">
          <div className="admin-notify-timeline-rail">
            <span className="admin-notify-timeline-node" />
            {i < 2 ? <span className="admin-notify-timeline-line" /> : null}
          </div>
          <div className="admin-notify-timeline-body">
            <span className="admin-notify-timeline-tag">{tag}</span>
            <p className="admin-notify-timeline-title">No {tag.toLowerCase()} updates yet</p>
            <p className="admin-notify-timeline-desc">Release notes and system notices will stack on this timeline.</p>
          </div>
        </article>
      ))}
    </div>
  );
}

const LAYOUTS: Record<NotificationLayout, () => ReactNode> = {
  radar: RadarLayout,
  threads: ThreadsLayout,
  ledger: LedgerLayout,
  mesh: MeshLayout,
  console: ConsoleLayout,
  timeline: TimelineLayout
};

export function AdminNotificationCategoryPage({ hash }: { hash: string }) {
  const category = resolveNotificationCategory(hash);
  if (!category) return null;
  const Layout = LAYOUTS[category.layout];
  const pageId = hash.slice(1);

  return (
    <div id={pageId} className={`admin-notify-page admin-notify-page--${category.layout} admin-notify-page--${category.accent}`}>
      <NotifyHero category={category} />
      <div className="admin-notify-stage">
        <Layout />
      </div>
      <footer className="admin-notify-footer">
        <AdminBtnSecondary type="button" disabled>
          Mark channel read
        </AdminBtnSecondary>
      </footer>
    </div>
  );
}

export function AdminNotificationPageRouter({ hash }: { hash: string }) {
  if (!isAdminNotificationPageHash(hash)) return null;
  return <AdminNotificationCategoryPage hash={hash} />;
}
