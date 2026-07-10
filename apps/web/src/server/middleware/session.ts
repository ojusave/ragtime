import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { SESSION_COOKIE, type SessionRequest } from "../types.js";

const MAX_AGE_SEC = 7 * 24 * 60 * 60;

function attachSession(req: FastifyRequest, sessionId: string): SessionRequest {
  return Object.assign(req, { sessionId });
}

/** Attach an anonymous session id to every request via httpOnly cookie. */
export function registerSessionMiddleware(app: FastifyInstance): void {
  app.addHook("onRequest", async (req, reply) => {
    const existing = req.cookies[SESSION_COOKIE];
    const sessionId = existing && existing.length > 0 ? existing : randomUUID();

    if (!existing) {
      reply.setCookie(SESSION_COOKIE, sessionId, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: MAX_AGE_SEC,
        secure: process.env.NODE_ENV === "production",
      });
    }

    attachSession(req, sessionId);
  });
}
