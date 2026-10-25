import { describe, expect, test } from "bun:test";
import { TokenBucket } from "./rate-limit.ts";

describe("TokenBucket", () => {
  test("allows a burst up to capacity, then refuses", () => {
    const bucket = new TokenBucket(3, 1, 0);
    expect([bucket.take(0), bucket.take(0), bucket.take(0), bucket.take(0)]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  test("refills over time, never past capacity", () => {
    const bucket = new TokenBucket(2, 1, 0);
    bucket.take(0);
    bucket.take(0);
    expect(bucket.take(500)).toBe(false);
    expect(bucket.take(1_000)).toBe(true);
    expect(bucket.isFull(60_000)).toBe(true);
  });
});
