import {
  SERVEOS_SUPPORT_AGENT_SYSTEM_PROMPT,
  SUPPORT_AGENT_MAX_TOKENS,
  SUPPORT_AGENT_MODEL,
  SUPPORT_AGENT_TEMPERATURE,
  type SupportAgentMessage
} from "@serveos/agents";

type OpenAiChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function isSupportAgentConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function runSupportAgentChat(messages: SupportAgentMessage[]): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("support_agent_unconfigured");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: SUPPORT_AGENT_MODEL,
      messages: [{ role: "system", content: SERVEOS_SUPPORT_AGENT_SYSTEM_PROMPT }, ...messages],
      temperature: SUPPORT_AGENT_TEMPERATURE,
      max_tokens: SUPPORT_AGENT_MAX_TOKENS
    })
  });

  const data = (await res.json()) as OpenAiChatCompletionResponse;

  if (!res.ok) {
    const detail = data.error?.message ?? `openai_http_${res.status}`;
    throw new Error(detail);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new Error("empty_model_reply");
  }

  return reply;
}
