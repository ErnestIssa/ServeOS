export type SupportAgentRole = "user" | "assistant";

export type SupportAgentMessage = {
  role: SupportAgentRole;
  content: string;
};
