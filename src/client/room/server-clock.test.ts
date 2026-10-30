import { describe, expect, test } from "bun:test";
import { createEffect, createRoot } from "solid-js";
import { useServerClock } from "./server-clock.ts";

describe("useServerClock", () => {
  // The idle countdown also runs between races, often in a tab in the background.
  test("ticks every second outside a race", async () => {
    const reads: number[] = [];

    const dispose = createRoot((dispose) => {
      const now = useServerClock({
        race: () => ({ phase: "open" }) as never,
        clockOffset: () => 0,
      });
      createEffect(() => reads.push(now()));
      return dispose;
    });
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    dispose();

    expect(reads.length).toBeGreaterThanOrEqual(2);
  });
});
