import { renderServeOsEmail, type ServeOsEmailTemplateId } from "@serveos/email-templates";
import { useMemo, useState } from "react";
import { ServeOsWordmark } from "../signup/SignupShell";

const SAMPLE_TEMPLATES: Array<{ id: ServeOsEmailTemplateId; label: string }> = [
  { id: "password_reset", label: "Password reset" },
  { id: "email_change", label: "Email change" },
  { id: "security_alert", label: "Security alert" },
  { id: "staff_invitation", label: "Staff invitation" },
  { id: "ownership_transfer", label: "Ownership transfer" },
  { id: "account_closure", label: "Account closure" },
  { id: "notification", label: "Notification" },
  { id: "communication_preferences", label: "Communication preferences" }
];

function sampleForTemplate(id: ServeOsEmailTemplateId) {
  const preferencesUrl = `${window.location.origin}/preferences`;
  switch (id) {
    case "password_reset":
      return renderServeOsEmail({
        template: "password_reset",
        resetUrl: `${window.location.origin}/login?resetToken=sample`,
        expiresHours: 24,
        preferencesUrl
      });
    case "email_change":
      return renderServeOsEmail({
        template: "email_change",
        confirmUrl: `${window.location.origin}/admin?emailChangeToken=sample`,
        expiresHours: 24,
        preferencesUrl
      });
    case "security_alert":
      return renderServeOsEmail({
        template: "security_alert",
        alertTitle: "New sign-in detected",
        detail: "Someone signed in to your ServeOS account from a new device.",
        ipMasked: "192.168.x.x",
        preferencesUrl
      });
    case "staff_invitation":
      return renderServeOsEmail({
        template: "staff_invitation",
        fullName: "Alex Rivera",
        restaurantName: "Bistro Nord",
        intendedRole: "MANAGER",
        acceptUrl: `${window.location.origin}/invite?token=sample`,
        expiresAt: "2026-07-01",
        preferencesUrl
      });
    case "ownership_transfer":
      return renderServeOsEmail({
        template: "ownership_transfer",
        restaurantName: "Bistro Nord",
        fromEmail: "owner@bistro.se",
        preferencesUrl
      });
    case "account_closure":
      return renderServeOsEmail({
        template: "account_closure",
        coolingUntil: "2026-07-15",
        preferencesUrl
      });
    case "notification":
      return renderServeOsEmail({
        template: "notification",
        subject: "New reservation confirmed",
        title: "Reservation confirmed",
        body: "Table for 4 on Friday at 19:00.",
        actionUrl: window.location.origin,
        actionLabel: "Open in ServeOS",
        preferencesUrl
      });
    case "communication_preferences":
      return renderServeOsEmail({
        template: "communication_preferences",
        preferencesUrl: `${preferencesUrl}?token=sample`,
        emailMasked: "al•••@bistro.se"
      });
    default:
      return renderServeOsEmail({
        template: "notification",
        subject: "ServeOS",
        title: "Preview",
        body: "Sample email.",
        preferencesUrl
      });
  }
}

type Props = {
  onBack: () => void;
};

export function EmailTemplateGallery({ onBack }: Props) {
  const [active, setActive] = useState<ServeOsEmailTemplateId>("password_reset");
  const rendered = useMemo(() => sampleForTemplate(active), [active]);

  return (
    <div className="relative min-h-[100dvh] w-full bg-white/92">
      <div className="fixed left-5 top-6 z-50 sm:left-8 sm:top-8">
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm font-bold text-slate-700 shadow-sm backdrop-blur-md"
        >
          ← Back
        </button>
      </div>
      <div className="fixed right-5 top-6 z-50 sm:right-8 sm:top-8">
        <ServeOsWordmark className="text-xl sm:text-2xl" />
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-16 pt-24 sm:px-8">
        <header>
          <h1 className="font-display text-3xl font-extrabold text-slate-900">Email template gallery</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Design source for all ServeOS transactional emails. The API renders these templates at send time via{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">@serveos/email-templates</code>.
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          {SAMPLE_TEMPLATES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active === item.id
                  ? "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-violet-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              Subject: {rendered.subject}
            </div>
            <iframe
              title={`Email preview: ${active}`}
              srcDoc={rendered.html}
              className="h-[640px] w-full border-0 bg-slate-50"
              sandbox=""
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Plain text</p>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
              {rendered.text}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
