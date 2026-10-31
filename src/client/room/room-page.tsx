import { type JSX, Show, createEffect, createMemo, createResource, onCleanup } from "solid-js";
import { HomePage } from "../home/home-page.tsx";
import { refusalText } from "./action-labels.ts";
import { ClosingWarning, timeLeft, useActivityPings } from "./closing-warning.tsx";
import { connectRoom } from "./connection.ts";
import { RoomView } from "./room-view.tsx";
import { useServerClock } from "./server-clock.ts";

const blinkForMs = 60_000;

/** Connects to the room in the URL and shows it once the room has sent its first full picture. */
export function RoomPage(props: { slug: string; openRoom?: (slug: string) => void }): JSX.Element {
  const room = connectRoom(props.slug);
  const { now: serverNow, second: serverSecond } = useServerClock(room);

  // Reading this resource suspends the page, so a transition keeps the old page up until then.
  const [ready] = createResource(() => room.ready.then(() => true));

  useActivityPings({
    send: () => room.send({ type: "active" }),
    warned: () => room.idleClosesAt() !== null,
  });
  // A closed room keeps showing the time it closed at, so a race cut off by the server stops.
  const shownNow = () => room.closedAt() ?? serverNow();

  const title = createMemo(() => {
    const closesAt = room.gone() ? null : room.idleClosesAt();
    // In the last minute a warning sign comes and goes every second, so the tab blinks in a row
    // of tabs.
    const now = serverSecond();
    const lastMinute = closesAt !== null && closesAt - now <= blinkForMs;
    const blink = lastMinute && Math.floor(now / 1000) % 2 === 0 ? "⚠ " : "";
    const warning =
      closesAt === null ? "" : `${blink}(${timeLeft(closesAt, now)}) still racing? · `;
    return `${warning}${room.race()?.goal ?? "race"} · raceme`;
  });
  createEffect(() => {
    document.title = title();
  });
  onCleanup(() => {
    document.title = "raceme";
  });

  const connecting = (
    <main>
      <p role="status">{room.notice() ?? "connecting…"}</p>
    </main>
  );

  const closed = (
    <HomePage
      notice={room.notice() ?? refusalText.roomGone}
      {...(props.openRoom ? { open: props.openRoom } : {})}
    />
  );

  return (
    // A closed room nobody entered has no results worth keeping, so it shows the start page.
    <Show
      when={!(ready() && room.gone() && (room.race()?.entrants.length ?? 0) === 0)}
      fallback={closed}
    >
      <Show when={ready() && room.me()} fallback={connecting}>
        {(me) => (
          <Show when={room.race()} fallback={connecting}>
            {(race) => (
              <>
                <RoomView
                  slug={props.slug}
                  race={race()}
                  me={me()}
                  now={shownNow()}
                  inviteUrl={location.href}
                  notice={room.notice()}
                  feed={room.feed()}
                  send={room.send}
                  closed={room.gone()}
                  chatEveryMs={room.chatEveryMs()}
                  watchers={room.watchers()}
                  closesFor={room.closesFor()}
                  {...(room.closesAt() !== null ? { closesAt: room.closesAt() ?? 0 } : {})}
                />
                <ClosingWarning
                  closesAt={room.gone() ? null : room.idleClosesAt()}
                  now={serverSecond()}
                />
                <ClosingWarning
                  closesAt={room.gone() ? null : room.restartClosesAt()}
                  now={serverSecond()}
                  reason="restart"
                />
              </>
            )}
          </Show>
        )}
      </Show>
    </Show>
  );
}
