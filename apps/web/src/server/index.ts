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
