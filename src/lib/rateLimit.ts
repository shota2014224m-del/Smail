// シンプルなインメモリレート制限
// Railway は単一プロセスなのでこれで十分

const store = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true; // OK
  }

  if (entry.count >= maxRequests) {
    return false; // 制限超過
  }

  entry.count++;
  return true; // OK
}
