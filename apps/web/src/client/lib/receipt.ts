export function formatReceipt(r: {
  latencyMs: number;
  costUsd: number;
  costUnknown?: boolean;
  provider?: string;
}): string {
  const cost = r.costUnknown ? "n/a" : `$${r.costUsd.toFixed(4)}`;
  const provider = r.provider ? ` via ${r.provider}` : "";
  return `${r.latencyMs}ms, ${cost}${provider}`;
}
