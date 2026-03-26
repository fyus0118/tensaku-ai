/**
 * シンプルなインメモリレート制限。
 * 本番では Upstash Redis に差し替え可能。
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// 5分ごとにストアを掃除
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}, 300_000);

interface RateLimitConfig {
  /** ウィンドウ内の最大リクエスト数 */
  limit: number;
  /** ウィンドウ幅（秒） */
  windowSeconds: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + config.windowSeconds * 1000;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  entry.count++;
  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/** API ルートで使う共通ヘルパー */
export function checkRateLimit(userId: string, endpoint: string, config: RateLimitConfig): Response | null {
  const result = rateLimit(`${endpoint}:${userId}`, config);
  if (!result.allowed) {
    return Response.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
        },
      }
    );
  }
  return null;
}

// デフォルト設定
export const RATE_LIMITS = {
  /** AI生成系（Chat, Practice POST, Review, Flashcards POST）: 20回/分 */
  ai: { limit: 20, windowSeconds: 60 },
  /** データ取得系（GET）: 60回/分 */
  read: { limit: 60, windowSeconds: 60 },
  /** データ書き込み系（PUT）: 30回/分 */
  write: { limit: 30, windowSeconds: 60 },
} as const;
