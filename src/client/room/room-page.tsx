import { type JSX, Show, createEffect, createResource, onCleanup } from "solid-js";
import { HomePage } from "../home/home-page.tsx";
import { refusalText } from "./action-labels.ts";
import { connectRoom } from "./connection.ts";
import { IdleWarning, timeLeft, useActivityPings } from "./idle-warning.tsx";
import { RoomView } from "./room-view.tsx";
import { useServerClock } from "./server-clock.ts";

const blinkForMs = 60_000;

/** Connects to the room in the URL and shows it once the room has sent its first full picture. */
export function RoomPage(props: { slug: string; openRoom?: (slug: string) => void }): JSX.Element {
  const room = connectRoom(props.slug);
  const serverNow = useServerClock(room);

  // Reading this resource suspends the page, so a transition keeps the old page up until then.
  const [ready] = createResource(() => room.ready.then(() => true));

  useActivityPings({
    send: () => room.send({ type: "active" }),
    warned: () => room.idleClosesAt() !== null,
  });
  createEffect(() => {
    const closesAt = room.idleClosesAt();
    // In the last minute a warning sign comes and goes every second, so the tab blinks in a row
    // of tabs.
    const now = serverNow();
    const lastMinute = closesAt !== null && closesAt - now <= blinkForMs;
    const blink = lastMinute && Math.floor(now / 1000) % 2 === 0 ? "⚠ " : "";
    const warning =
      closesAt === null ? "" : `${blink}(${timeLeft(closesAt, now)}) still racing? · `;
    document.title = `${warning}${room.race()?.goal ?? "Race"} · raceme`;
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
              <>
                <RoomView
                  race={race()}
                  me={me()}
                  now={serverNow()}
                  inviteUrl={location.href}
                  notice={room.notice()}
                  feed={room.feed()}
                  send={room.send}
                />
                <IdleWarning
                  closesAt={room.idleClosesAt()}
                  now={serverNow()}
                  quietFor={room.idleQuietFor()}
                />
              </>
            )}
          </Show>
        )}
      </Show>
    </Show>
  );
}
