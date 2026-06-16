import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type AdminToastTone = "success" | "error";

type AdminToastItem = {
  id: string;
  message: string;
  tone: AdminToastTone;
  durationMs: number;
};

type AdminToastContextValue = {
  pushToast: (message: string, tone?: AdminToastTone, durationMs?: number) => void;
};

const AdminToastContext = createContext<AdminToastContextValue | null>(null);

function AdminToastCard({ toast, onDone }: { toast: AdminToastItem; onDone: (id: string) => void }) {
  const doneRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone(toast.id);
    }, toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [onDone, toast.durationMs, toast.id]);

  return (
    <div
      className={`admin-toast admin-toast--${toast.tone}`}
      role={toast.tone === "error" ? "alert" : "status"}
      aria-live="polite"
    >
      <p className="admin-toast-message">{toast.message}</p>
      <div
        className="admin-toast-progress"
        style={{ animationDuration: `${toast.durationMs}ms` }}
        aria-hidden
      />
    </div>
  );
}

function AdminToastHost({ toasts, onDone }: { toasts: AdminToastItem[]; onDone: (id: string) => void }) {
  if (!toasts.length) return null;

  return createPortal(
    <div className="admin-toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <AdminToastCard key={toast.id} toast={toast} onDone={onDone} />
      ))}
    </div>,
    document.body
  );
}

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<AdminToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback((message: string, tone: AdminToastTone = "success", durationMs = 5200) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message: trimmed, tone, durationMs }]);
  }, []);

  return (
    <AdminToastContext.Provider value={{ pushToast }}>
      {children}
      <AdminToastHost toasts={toasts} onDone={dismissToast} />
    </AdminToastContext.Provider>
  );
}

export function useAdminToast() {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    throw new Error("useAdminToast must be used within AdminToastProvider");
  }
  return ctx;
}
