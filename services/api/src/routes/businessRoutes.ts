import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { lookupSwedishCompanyByOrgNumber } from "../services/companyLookupService.js";

export function registerBusinessRoutes(app: FastifyInstance) {
  const schema = z.object({
    orgNumber: z.string().min(1)
  });

  app.post("/api/business/lookup-company", async (req, reply) => {
    const body = schema.parse(req.body);

    try {
      const r = await lookupSwedishCompanyByOrgNumber(body.orgNumber);
      if (r.kind === "invalid") {
        return reply.status(400).send({ success: false, message: "Invalid organization number" });
      }
      if (r.kind === "rate_limited") {
        return reply
          .status(429)
          .header("Retry-After", String(r.retryAfterSec))
          .send({ success: false, message: "Lookup unavailable" });
      }

      return reply.send(r.result);
    } catch (err) {
      app.log.warn({ err }, "company_lookup_failed");
      return reply.send({ success: false, message: "Lookup unavailable" });
    }
  });
}

