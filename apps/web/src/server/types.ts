import type { FastifyRequest } from "fastify";

export const SESSION_COOKIE = "ragtime_session";

export type SessionRequest = FastifyRequest & { sessionId: string };

export function asSessionRequest(req: FastifyRequest): SessionRequest {
  return req as SessionRequest;
}
