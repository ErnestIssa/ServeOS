import { useCallback, useState } from "react";
import { SERVEOS_SUPPORT_GREETING } from "./knowledge.js";
import { getServeosSupportReply } from "./reply.js";
import type { SupportAgentMessage } from "./types.js";

const REPLY_DELAY_MS = 450;

function initialMessages(): SupportAgentMessage[] {
  return [{ role: "assistant", content: SERVEOS_SUPPORT_GREETING }];
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useSupportAgentChat() {
  const [messages, setMessages] = useState<SupportAgentMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);

  const sendUserMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content || loading) return false;

      const nextMessages: SupportAgentMessage[] = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      setLoading(true);

      await delay(REPLY_DELAY_MS);

      const reply = getServeosSupportReply(content);
      setMessages([...nextMessages, { role: "assistant", content: reply }]);
      setLoading(false);
      return true;
    },
    [loading, messages]
  );

  const resetChat = useCallback(() => {
    setMessages(initialMessages());
    setLoading(false);
  }, []);

  return {
    messages,
    loading,
    sendUserMessage,
    resetChat
  };
}
