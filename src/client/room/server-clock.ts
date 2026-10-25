import { createEffect, createSignal, onCleanup } from "solid-js";
import type { RoomConnection } from "./connection.ts";

/**
 * Returns the server's time, read fresh on every access. It redraws every frame while the race
 * clock runs, because a timer would leave that clock stale by up to a second. While the room is
 * warned as idle it redraws every second, since animation frames stop in background tabs and the
 * countdown also shows in the tab title.
 */
export function useServerClock(
  room: Pick<RoomConnection, "race" | "idleClosesAt" | "clockOffset">,
): () => number {
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

  let interval: ReturnType<typeof setInterval> | undefined;
  createEffect(() => {
    clearInterval(interval);
    if (room.idleClosesAt() !== null) {
      interval = setInterval(tick, 1_000);
    }
  });

  onCleanup(() => {
    cancelAnimationFrame(request);
    clearInterval(interval);
  });

  return () => {
    frame();
    return Date.now() + room.clockOffset();
  };
}
