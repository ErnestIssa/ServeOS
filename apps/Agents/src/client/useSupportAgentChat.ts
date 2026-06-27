import { useCallback, useState } from "react";
import { SUPPORT_AGENT_GREETING } from "../support/constants.js";
import type { SupportAgentMessage } from "../support/types.js";
import { postSupportAgentChat } from "./supportAgentApi.js";

const DEFAULT_ERROR_REPLY = "Something went wrong. Try again in a moment.";

function initialMessages(): SupportAgentMessage[] {
  return [{ role: "assistant", content: SUPPORT_AGENT_GREETING }];
}

type Options = {
  apiBaseUrl: string;
};

export function useSupportAgentChat({ apiBaseUrl }: Options) {
  const [messages, setMessages] = useState<SupportAgentMessage[]>(initialMessages);
  const [loading, setLoading] = useState(false);

  const sendUserMessage = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (!content || loading) return false;

      const nextMessages: SupportAgentMessage[] = [...messages, { role: "user", content }];
      setMessages(nextMessages);
      setLoading(true);

      const res = await postSupportAgentChat(apiBaseUrl, { messages: nextMessages });

      if (res.ok && res.reply.trim()) {
        setMessages([...nextMessages, { role: "assistant", content: res.reply.trim() }]);
      } else {
        const errorText =
          !res.ok && "message" in res && res.message?.trim()
            ? res.message.trim()
            : DEFAULT_ERROR_REPLY;
        setMessages([...nextMessages, { role: "assistant", content: errorText }]);
      }

      setLoading(false);
      return true;
    },
    [apiBaseUrl, loading, messages]
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
