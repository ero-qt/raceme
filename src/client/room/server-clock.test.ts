import { describe, expect, test } from "bun:test";
import { createEffect, createRoot } from "solid-js";
import { useServerClock } from "./server-clock.ts";

describe("useServerClock", () => {
  // The idle countdown also runs between races, often in a tab in the background.
  test("ticks every second outside a race", async () => {
    const reads: number[] = [];

    const dispose = createRoot((dispose) => {
      const { now } = useServerClock({
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

  // The room timer, the closing warnings and the tab title only show whole seconds, so they
  // shouldn't redraw on every frame of the race clock.
  test("during a race, the whole seconds change once a second while the time changes every frame", async () => {
    const frames: number[] = [];
    const seconds: number[] = [];

    const dispose = createRoot((dispose) => {
      const { now, second } = useServerClock({
        race: () => ({ phase: "running" }) as never,
        clockOffset: () => 0,
      });
      createEffect(() => frames.push(now()));
      createEffect(() => seconds.push(second()));
      return dispose;
    });
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    dispose();

    expect(frames.length).toBeGreaterThanOrEqual(10);
    expect(seconds.length).toBeLessThanOrEqual(3);
    expect(seconds.every((value) => value % 1000 === 0)).toBe(true);
  });
});
