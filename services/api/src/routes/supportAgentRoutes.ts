import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  SUPPORT_AGENT_MAX_MESSAGE_CHARS,
  SUPPORT_AGENT_MAX_MESSAGES
} from "@serveos/agents";
import { isSupportAgentConfigured, runSupportAgentChat } from "../lib/supportAgent/supportAgentService.js";

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(SUPPORT_AGENT_MAX_MESSAGE_CHARS)
      })
    )
    .min(1)
    .max(SUPPORT_AGENT_MAX_MESSAGES)
});

export function registerSupportAgentRoutes(app: FastifyInstance) {
  app.post("/api/support-agent", async (req, reply) => {
    if (!isSupportAgentConfigured()) {
      return reply.status(503).send({
        ok: false,
        error: "support_agent_unconfigured",
        message: "ServeOS AI is not available right now. Please try again later or email support."
      });
    }

    let body: z.infer<typeof chatSchema>;
    try {
      body = chatSchema.parse(req.body);
    } catch {
      return reply.status(400).send({
        ok: false,
        error: "validation_error",
        message: "Invalid message payload."
      });
    }

    const last = body.messages[body.messages.length - 1];
    if (last.role !== "user") {
      return reply.status(400).send({
        ok: false,
        error: "validation_error",
        message: "The last message must be from the user."
      });
    }

    try {
      const replyText = await runSupportAgentChat(body.messages);
      return reply.send({ ok: true, reply: replyText });
    } catch (err) {
      app.log.warn({ err }, "support_agent_chat_failed");
      return reply.status(502).send({
        ok: false,
        error: "support_agent_failed",
        message: "Something went wrong. Try again in a moment."
      });
    }
  });
}
