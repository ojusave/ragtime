/** Injected before provider calls when CHAOS_FAILURE_RATE > 0. Retry-safe: fires before spend. */
export class ChaosError extends Error {
  constructor() {
    super("Chaos injection: simulated task failure");
    this.name = "ChaosError";
  }
}

export function maybeChaos(): void {
  const rate = Number(process.env.CHAOS_FAILURE_RATE ?? 0);
  if (rate <= 0) return;
  if (Math.random() < rate) throw new ChaosError();
}

export function chunkIntoBatches<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}
