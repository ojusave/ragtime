const BASE = "";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const body = err as { error?: string | object; message?: string };
    const message =
      body.message ??
      (typeof body.error === "string" ? body.error : undefined) ??
      res.statusText;
    throw new Error(message);
  }
  const json = await res.json();
  return json.data as T;
}
