import { createGateway } from "../wiring.js";

let catalogCache: { data: unknown; expires: number } | null = null;

export async function getModelCatalog() {
  if (catalogCache && catalogCache.expires > Date.now()) {
    return catalogCache.data;
  }
  const gateway = createGateway();
  const data = await gateway.catalog();
  catalogCache = { data, expires: Date.now() + 10 * 60 * 1000 };
  return data;
}
