const buckets = new Map<string, number[]>();

export function isRateLimited(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  if (buckets.size > 256) {
    for (const [k, ts] of buckets) {
      if (ts.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return true;
  }
  recent.push(now);
  buckets.set(key, recent);
  return false;
}
