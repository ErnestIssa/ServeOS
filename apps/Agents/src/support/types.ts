export type SupportAgentRole = "user" | "assistant";

export type SupportAgentMessage = {
  role: SupportAgentRole;
  content: string;
};

export type SupportAgentChatRequest = {
  messages: SupportAgentMessage[];
};

export type SupportAgentChatResponse =
  | { ok: true; reply: string }
  | { ok: false; error?: string; message?: string };
