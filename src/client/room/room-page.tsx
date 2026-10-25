import { type JSX, Show, createEffect, createResource, createSignal, onCleanup } from "solid-js";
import { HomePage } from "../home/home-page.tsx";
import { refusalText } from "./action-labels.ts";
import { type RoomConnection, connectRoom } from "./connection.ts";
import { RoomView } from "./room-view.tsx";

/** Connects to the room in the URL and shows it once the room has sent its first full picture. */
export function RoomPage(props: { slug: string; openRoom?: (slug: string) => void }): JSX.Element {
  const room = connectRoom(props.slug);
  const serverNow = useServerClock(room);

  // Reading this resource suspends the page, so a transition keeps the old page up until then.
  const [ready] = createResource(() => room.ready.then(() => true));

  createEffect(() => {
    document.title = `${room.race()?.goal ?? "Race"} · raceme`;
  });
  onCleanup(() => {
    document.title = "raceme";
  });

  const connecting = (
    <main>
      <p role="status">{room.notice() ?? "Connecting…"}</p>
    </main>
  );

  const closed = (
    <HomePage notice={refusalText.roomGone} {...(props.openRoom ? { open: props.openRoom } : {})} />
  );

  return (
    <Show when={!(ready() && room.gone())} fallback={closed}>
      <Show when={ready() && room.me()} fallback={connecting}>
        {(me) => (
          <Show when={room.race()} fallback={connecting}>
            {(race) => (
              <RoomView
                race={race()}
                me={me()}
                now={serverNow()}
                inviteUrl={location.href}
                notice={room.notice()}
                feed={room.feed()}
                send={room.send}
              />
            )}
          </Show>
        )}
      </Show>
    </Show>
  );
}

/**
 * Returns the server's time, read fresh on every access and redrawn every frame while a clock
 * runs. A timer would leave the clock stale by up to a second, because browsers throttle timers.
 */
function useServerClock(room: RoomConnection): () => number {
  const [frame, setFrame] = createSignal(0);
  let request = 0;
  const draw = () => {
    setFrame((count) => count + 1);
    request = requestAnimationFrame(draw);
  };
  createEffect(() => {
    const phase = room.race()?.phase;
    cancelAnimationFrame(request);
    if (phase === "countdown" || phase === "running") {
      request = requestAnimationFrame(draw);
    }
  });
  onCleanup(() => cancelAnimationFrame(request));

  return () => {
    frame();
    return Date.now() + room.clockOffset();
  };
}
