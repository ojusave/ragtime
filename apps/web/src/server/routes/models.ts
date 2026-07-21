import type { FastifyInstance } from "fastify";
import { getModelCatalog } from "../lib/catalog-cache.js";
import { toErrorBody } from "../lib/error-response.js";

export function registerModelRoutes(app: FastifyInstance): void {
  app.get("/api/models", async (_req, reply) => {
    try {
      const data = await getModelCatalog();
      return { data };
    } catch (err) {
      const body = toErrorBody(err, "Could not load the model catalog.");
      return reply.status(502).send(body);
    }
  });
}
