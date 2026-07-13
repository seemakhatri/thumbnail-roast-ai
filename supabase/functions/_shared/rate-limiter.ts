import { createLogger } from "./logger.ts";

const logger = createLogger("rate-limiter");

interface RateLimitEntry {
  count: number;
  resetAt: number;
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();

  constructor(
    private defaultWindowMs: number = 60000,
    private defaultMaxRequests: number = 10
  ) {}

  async checkLimit(
    identifier: string,
    options?: {
      windowMs?: number;
      maxRequests?: number;
    }
  ): Promise<RateLimitResult> {
    const windowMs = options?.windowMs || this.defaultWindowMs;
    const maxRequests = options?.maxRequests || this.defaultMaxRequests;

    const now = Date.now();
    const entry = this.store.get(identifier);

    if (Math.random() < 0.001) {
      this.cleanup();
    }

    if (!entry || now > entry.resetAt) {
      const newEntry: RateLimitEntry = {
        count: 1,
        resetAt: now + windowMs,
        windowMs,
        maxRequests,
      };
      this.store.set(identifier, newEntry);

      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: new Date(now + windowMs),
        limit: maxRequests,
      };
    }

    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: new Date(entry.resetAt),
        limit: maxRequests,
      };
    }

    entry.count++;
    this.store.set(identifier, entry);

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: new Date(entry.resetAt),
      limit: maxRequests,
    };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  getRemaining(identifier: string): number {
    const entry = this.store.get(identifier);
    if (!entry || Date.now() > entry.resetAt) {
      return entry?.maxRequests || this.defaultMaxRequests;
    }
    return entry.maxRequests - entry.count;
  }

  reset(identifier: string): void {
    this.store.delete(identifier);
  }
}

export const authRateLimiter = new RateLimiter(60000, 10);
export const apiRateLimiter = new RateLimiter(60000, 30);
export const guestRateLimiter = new RateLimiter(3600000, 3);