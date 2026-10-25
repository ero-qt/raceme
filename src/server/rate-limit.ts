/** Allows bursts up to `capacity`, refilling `perSecond` tokens each second. */
export class TokenBucket {
  #tokens: number;
  #updatedAt: number;

  constructor(
    readonly capacity: number,
    readonly perSecond: number,
    now: number,
  ) {
    this.#tokens = capacity;
    this.#updatedAt = now;
  }

  take(now: number): boolean {
    this.#refill(now);
    if (this.#tokens < 1) {
      return false;
    }

    this.#tokens -= 1;
    return true;
  }

  hasToken(now: number): boolean {
    this.#refill(now);
    return this.#tokens >= 1;
  }

  isFull(now: number): boolean {
    this.#refill(now);
    return this.#tokens >= this.capacity;
  }

  #refill(now: number): void {
    const elapsedSeconds = Math.max(0, now - this.#updatedAt) / 1000;
    this.#tokens = Math.min(this.capacity, this.#tokens + elapsedSeconds * this.perSecond);
    this.#updatedAt = now;
  }
}
