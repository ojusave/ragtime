/** Run async work in bounded parallel waves to avoid workflow/DB overload. */
export async function runInWaves<T>(
  items: T[],
  waveSize: number,
  fn: (item: T) => unknown
): Promise<PromiseSettledResult<unknown>[]> {
  const size = Math.max(1, waveSize);
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += size) {
    const wave = items.slice(i, i + size);
    const waveResults = await Promise.allSettled(wave.map((item) => Promise.resolve(fn(item))));
    results.push(...waveResults);
  }
  return results;
}
