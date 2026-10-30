import { createEffect, createSignal, onCleanup } from "solid-js";
import type { RoomConnection } from "./connection.ts";

/**
 * Returns the server's time, read fresh on every access. It redraws every frame while the race
 * clock runs, because a timer would leave that clock stale by up to a second. It also redraws every
 * second for the room timer and the idle countdown, which shows in the tab title too, since
 * animation frames stop in background tabs.
 */
export function useServerClock(room: Pick<RoomConnection, "race" | "clockOffset">): () => number {
  const [frame, setFrame] = createSignal(0);
  const tick = () => setFrame((count) => count + 1);

  let request = 0;
  const draw = () => {
    tick();
    request = requestAnimationFrame(draw);
  };
  createEffect(() => {
    const phase = room.race()?.phase;
    cancelAnimationFrame(request);
    if (phase === "countdown" || phase === "running") {
      request = requestAnimationFrame(draw);
    }
  });

  const interval = setInterval(tick, 1_000);

  onCleanup(() => {
    cancelAnimationFrame(request);
    clearInterval(interval);
  });

  return () => {
    frame();
    return Date.now() + room.clockOffset();
  };
}
