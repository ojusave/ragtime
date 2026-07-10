import { friendlyError } from "./copy.js";

const BASE = "";

function jsonHeaders(init?: RequestInit): Record<string, string> {
  if (init?.body instanceof FormData) return {};
  if (init?.body == null || init.body === "") return {};
  return { "Content-Type": "application/json" };
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders(init),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const body = err as { error?: string | object; message?: string };
    const raw =
      body.message ??
      (typeof body.error === "string" ? body.error : undefined) ??
      res.statusText;
    throw new Error(friendlyError(raw));
  }
  const json = await res.json();
  return json.data as T;
}
