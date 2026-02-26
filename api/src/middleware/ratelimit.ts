// Rate limiting middleware using KV

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

export async function checkRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const windowKey = `${key}:${Math.floor(now / windowSeconds)}`;
  
  const current = await kv.get(windowKey);
  const count = current ? parseInt(current, 10) : 0;
  
  if (count >= limit) {
    const resetAt = (Math.floor(now / windowSeconds) + 1) * windowSeconds;
    return { allowed: false, remaining: 0, resetAt };
  }
  
  // Increment counter
  await kv.put(windowKey, String(count + 1), { expirationTtl: windowSeconds });
  
  return {
    allowed: true,
    remaining: limit - count - 1,
    resetAt: (Math.floor(now / windowSeconds) + 1) * windowSeconds
  };
}

// Credit-specific stricter rate limit
export async function checkCreditRateLimit(
  kv: KVNamespace,
  userId: string
): Promise<RateLimitResult> {
  const key = `credits:${userId}`;
  return checkRateLimit(kv, key, 10, 60); // 10 credit operations per minute
}

// Admin rate limit (stricter)
export async function checkAdminRateLimit(
  kv: KVNamespace,
  adminUserId: string
): Promise<RateLimitResult> {
  const key = `admin:${adminUserId}`;
  return checkRateLimit(kv, key, 30, 60); // 30 admin operations per minute
}
