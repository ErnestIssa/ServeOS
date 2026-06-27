import { useEffect, useRef, useState } from "react";
import { useSupportAgentChat } from "./useSupportAgentChat.js";

const COMPOSER_MAX_LINES = 8;

function SendMessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

type Props = {
  apiBaseUrl: string;
};

export function SupportAgentThread({ apiBaseUrl }: Props) {
  const { messages, loading, sendUserMessage } = useSupportAgentChat({ apiBaseUrl });
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasDraft = draft.trim().length > 0;

  const resizeComposer = () => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const styles = window.getComputedStyle(el);
    const lineHeight = Number.parseFloat(styles.lineHeight) || 18;
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
    const maxHeight = lineHeight * COMPOSER_MAX_LINES + paddingTop + paddingBottom;
    const nextHeight = Math.min(el.scrollHeight, maxHeight);

    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  useEffect(() => {
    resizeComposer();
  }, [draft]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const submitMessage = async () => {
    if (!hasDraft || loading) return;
    const content = draft;
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.overflowY = "hidden";
    }
    await sendUserMessage(content);
  };

  return (
    <div className="support-popup-messages-thread support-popup-agent-thread">
      <div
        ref={scrollRef}
        className="support-popup-messages-thread-body support-popup-agent-thread-body"
        aria-live="polite"
      >
        <div className="support-popup-agent-messages">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`support-popup-agent-msg support-popup-agent-msg--${message.role}`}
            >
              {message.content}
            </div>
          ))}
          {loading ? (
            <div className="support-popup-agent-msg support-popup-agent-msg--assistant support-popup-agent-msg--typing">
              <span className="support-popup-agent-typing-dot" />
              <span className="support-popup-agent-typing-dot" />
              <span className="support-popup-agent-typing-dot" />
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="support-popup-messages-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void submitMessage();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          className="support-popup-messages-composer-input"
          placeholder="Write a message..."
          value={draft}
          disabled={loading}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submitMessage();
            }
          }}
        />
        <button
          type="submit"
          className={`support-popup-messages-composer-send${hasDraft && !loading ? " is-active" : ""}`}
          aria-label="Send message"
          disabled={!hasDraft || loading}
        >
          <SendMessageIcon className="h-5 w-5" />
        </button>
      </form>
    </div>
  );
}
