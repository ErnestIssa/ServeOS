import type { FastifyInstance } from "fastify";
import { buildPublicClientConfig } from "../lib/util/clientConfig.js";

export function registerConfigRoutes(app: FastifyInstance) {
  /** Public client bootstrap — web/mobile fetch this; no secrets, no frontend `.env` service setup. */
  app.get("/config/client", async () => buildPublicClientConfig());
}
