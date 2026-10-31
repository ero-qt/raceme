import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import type { RoomConnection } from "./connection.ts";

/**
 * Returns the server's time 2 ways. `now` changes every frame while the race clock runs, because
 * a timer would leave that clock stale by up to a second. Outside a race it changes every second,
 * since animation frames stop in background tabs. `second` is `now` cut to whole seconds, for the
 * room timer, the closing warnings and the tab title, which only show whole seconds.
 */
export function useServerClock(room: Pick<RoomConnection, "race" | "clockOffset">): {
  now: Accessor<number>;
  second: Accessor<number>;
} {
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

  const now = () => {
    frame();
    return Date.now() + room.clockOffset();
  };
  const second = createMemo(() => Math.floor(now() / 1000) * 1000);
  return { now, second };
}
