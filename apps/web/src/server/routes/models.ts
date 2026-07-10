import type { FastifyInstance } from "fastify";
import { getModelCatalog } from "../lib/catalog-cache.js";

export function registerModelRoutes(app: FastifyInstance): void {
  app.get("/api/models", async () => {
    const data = await getModelCatalog();
    return { data };
  });
}
