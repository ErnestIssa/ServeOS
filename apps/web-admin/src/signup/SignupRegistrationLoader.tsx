import { useEffect, useState } from "react";

type Props = {
  mode?: "company-lookup" | "registration" | "account-creation";
  onInteract?: () => void;
};

const LOOKUP_INITIAL = "Retrieving company data";
const LOOKUP_SLOW = "Hang tight...";

/** Rotation Set 1 (Professional) — 2s per phrase, then repeats */
const ACCOUNT_CREATION_ROTATION = [
  "Creating your ServeOS workspace",
  "Setting up your business profile",
  "Preparing your dashboard and tools"
] as const;
const ACCOUNT_CREATION_PHRASE_MS = 2000;

function accountCreationPhrase(elapsedMs: number): string {
  const index = Math.floor(elapsedMs / ACCOUNT_CREATION_PHRASE_MS) % ACCOUNT_CREATION_ROTATION.length;
  return ACCOUNT_CREATION_ROTATION[index];
}

export function SignupRegistrationLoader({ mode = "registration", onInteract }: Props) {
  const [message, setMessage] = useState(
    mode === "company-lookup"
      ? LOOKUP_INITIAL
      : mode === "account-creation"
        ? ACCOUNT_CREATION_ROTATION[0]
        : ""
  );

  useEffect(() => {
    if (mode === "account-creation") {
      const startedAt = Date.now();
      const tick = () => setMessage(accountCreationPhrase(Date.now() - startedAt));
      tick();
      const interval = window.setInterval(tick, 250);
      return () => window.clearInterval(interval);
    }
    if (mode !== "company-lookup") {
      setMessage("");
      return;
    }

    setMessage(LOOKUP_INITIAL);
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 5000) {
        setMessage(LOOKUP_INITIAL);
        return;
      }
      const phase = Math.floor((elapsed - 5000) / 3000) % 2;
      const next = phase === 0 ? LOOKUP_SLOW : LOOKUP_INITIAL;
      setMessage((prev) => (prev === next ? prev : next));
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [mode]);

  const statusLabel = message || "Loading registration";

  const content = (
    <>
      <div className="signup-registration-loader" aria-hidden />
      {message ? (
        <p
          key={message}
          className="signup-loader-phrase min-h-[1.35rem] text-center text-sm font-semibold tracking-tight text-slate-600 sm:min-h-[1.5rem] sm:text-base"
        >
          {message}
        </p>
      ) : null}
    </>
  );

  if (onInteract) {
    return (
      <button
        type="button"
        onClick={onInteract}
        className="absolute inset-0 z-10 flex cursor-pointer flex-col items-center justify-center gap-4 border-0 bg-transparent p-0"
        aria-label={statusLabel}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4"
      role="status"
      aria-live="polite"
      aria-label={statusLabel}
    >
      {content}
    </div>
  );
}
