import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject
} from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type ScrollerCtx = {
  pinned: boolean;
  setPinned: (v: boolean) => void;
  scrollToBottom: () => void;
  viewportRef: RefObject<HTMLDivElement | null>;
};

const ScrollerContext = createContext<ScrollerCtx | null>(null);

export function MessageScrollerProvider({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [pinned, setPinned] = useState(true);
  const scrollToBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    setPinned(true);
  }, []);
  return (
    <ScrollerContext.Provider value={{ pinned, setPinned, scrollToBottom, viewportRef }}>
      {children}
    </ScrollerContext.Provider>
  );
}

function useScroller() {
  const ctx = useContext(ScrollerContext);
  if (!ctx) throw new Error("MessageScroller must be used inside MessageScrollerProvider");
  return ctx;
}

export function MessageScroller({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ui-message-scroller", className)} {...props} />;
}

export function MessageScrollerViewport({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { viewportRef, setPinned } = useScroller();
  return (
    <div
      ref={viewportRef}
      className={cx("ui-message-scroller-viewport", className)}
      onScroll={() => {
        const el = viewportRef.current;
        if (!el) return;
        const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setPinned(fromBottom < 48);
      }}
      {...props}
    >
      {children}
    </div>
  );
}

export function MessageScrollerContent({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const { pinned, viewportRef } = useScroller();
  const count = Array.isArray(children) ? children.length : 1;
  useEffect(() => {
    if (!pinned) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [count, pinned, viewportRef]);
  return (
    <div role="log" aria-relevant="additions" className={cx("ui-message-scroller-content", className)} {...props}>
      {children}
    </div>
  );
}

export function MessageScrollerButton({ className = "", ...props }: HTMLAttributes<HTMLButtonElement>) {
  const { pinned, scrollToBottom } = useScroller();
  if (pinned) return null;
  return (
    <button
      type="button"
      className={cx("ui-message-scroller-btn", className)}
      onClick={scrollToBottom}
      {...props}
    >
      <span className="sr-only">Jump to latest</span>
      ↓
    </button>
  );
}
