import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { envNumber } from "@ragtime/core";
import { registerSessionMiddleware } from "./middleware/session.js";
import { registerDemoRoutes } from "./routes/demo.js";
import { registerModelRoutes } from "./routes/models.js";
import { registerRunRoutes } from "./routes/runs.js";
import { registerTrialRoutes } from "./routes/trials.js";
import { registerInspectRoutes } from "./inspect.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(fastifyCookie);
  await app.register(fastifyMultipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  registerSessionMiddleware(app);

  app.get("/healthz", async () => ({ ok: true }));

  app.get("/api/config", async () => ({
    data: {
      maxTrialsPerRun: envNumber("MAX_TRIALS_PER_RUN", 324),
      maxRunBudgetUsd: envNumber("MAX_RUN_BUDGET_USD", 5),
    },
  }));

  // REVIEW H2 (High): CorpusPage calls /api/corpora/:id (GET, document upload, URL
  // ingestion, questions) but no corpora route module is registered here, so every call
  // 404s — the page is also unreachable from the router. Either implement/register
  // routes/corpora.ts (with ownership checks and H1's safe URL fetching) plus the React
  // routes, or delete the dead CorpusPage code and update the README.
  // REVIEW H5 (High): every spend-bearing route below (seed-demo, runs, inspect) is
  // anonymous with no rate limit, concurrency cap, or spend quota; the session cookie is
  // client-controlled and trivially rotated. Add IP+session rate limiting, per-session
  // concurrent-run/inspect limits, spend quotas, and disable demo seeding by default
  // outside local deployments.
  registerDemoRoutes(app);
  registerModelRoutes(app);
  registerRunRoutes(app);
  registerTrialRoutes(app);
  registerInspectRoutes(app);

  const clientDist = path.join(__dirname, "../../dist/client");
  await app.register(fastifyStatic, {
    root: clientDist,
    prefix: "/",
  });

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) {
      return reply.status(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen({ port, host: "0.0.0.0" });
}

const isMain =
  process.argv[1]?.endsWith("index.js") ||
  process.argv[1]?.endsWith("index.ts");

if (isMain) {
  startServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
