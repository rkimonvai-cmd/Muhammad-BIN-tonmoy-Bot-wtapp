'use strict';

class FixedWindowRateLimiter {
  constructor({ windowMs, max, maxEntries = 5000 }) {
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error('Rate limiter windowMs must be greater than zero.');
    }

    if (!Number.isFinite(max) || max <= 0) {
      throw new Error('Rate limiter max must be greater than zero.');
    }

    if (!Number.isFinite(maxEntries) || maxEntries <= 0) {
      throw new Error(
        'Rate limiter maxEntries must be greater than zero.'
      );
    }

    this.windowMs = Math.floor(windowMs);
    this.max = Math.floor(max);
    this.maxEntries = Math.floor(maxEntries);
    this.buckets = new Map();
  }

  consume(key) {
    const now = Date.now();
    const normalizedKey = String(key || 'anonymous');
    const safeKey = normalizedKey || 'anonymous';

    this.prune(now);

    let entry = this.buckets.get(safeKey);

    if (!entry || now >= entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + this.windowMs
      };
    }

    entry.count += 1;

    this.buckets.delete(safeKey);
    this.buckets.set(safeKey, entry);

    this.enforceLimit();

    return {
      allowed: entry.count <= this.max,
      count: entry.count,
      remaining: Math.max(0, this.max - entry.count),
      retryAfterMs: Math.max(0, entry.resetAt - now)
    };
  }

  prune(now) {
    if (this.buckets.size < Math.max(100, this.maxEntries / 2)) {
      return;
    }

    for (const [key, entry] of this.buckets) {
      if (now >= entry.resetAt) {
        this.buckets.delete(key);
      }
    }
  }

  enforceLimit() {
    while (this.buckets.size > this.maxEntries) {
      const oldestKey = this.buckets.keys().next().value;
      this.buckets.delete(oldestKey);
    }
  }
}

module.exports = {
  FixedWindowRateLimiter
};
