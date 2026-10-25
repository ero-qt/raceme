import { type JSX, type ParentProps, createSignal } from "solid-js";
import { Portal } from "solid-js/web";
import { formatClock } from "../../shared/format-time.ts";
import type { ClosesFor } from "../../shared/protocol.ts";
import { headerStatusId } from "../layout/site-header.tsx";
import { Button } from "../primitives/button.tsx";
import * as styles from "./room.css.ts";

/** Shows how long until the room closes. A click hides it in place until the next room or reload. */
export function RoomTimer(props: {
  closesAt: number;
  closesFor: ClosesFor;
  now: number;
}): JSX.Element {
  const [hidden, setHidden] = createSignal(false);
  const left = () => formatClock(Math.max(0, props.closesAt - props.now));
  const restart = () => props.closesFor === "restart";
  const restartTime = () => `${new Date(props.closesAt).toISOString().slice(11, 16)} UTC`;
  const shownTitle = () =>
    restart()
      ? `Room closes for a server restart at ${restartTime()}, click to hide`
      : "Room closes in this long, click to hide";
  const shownLabel = () =>
    restart() ? `Room closes for a server restart in ${left()}` : `Room closes in ${left()}`;

  return (
    <>
      <span class={styles.roomTimerDot} data-hidden={hidden()} aria-hidden="true">
        •
      </span>
      <Button
        variant="plain"
        class={styles.roomTimer}
        // A title that changed every second would make browsers drop the tooltip on each tick.
        title={hidden() ? "Show room timer" : shownTitle()}
        aria-label={hidden() ? "Show room timer" : shownLabel()}
        aria-pressed={!hidden()}
        onClick={() => setHidden(!hidden())}
      >
        {/* Keeps the time's width while hidden, so the button stays where people clicked it. */}
        <span class={styles.roomTimerTime} data-hidden={hidden()}>
          {left()}
        </span>
      </Button>
    </>
  );
}

/** Shows its children next to the site name in the header. Without a header they stay in place. */
export function HeaderStatus(props: ParentProps): JSX.Element {
  const slot = document.getElementById(headerStatusId);
  return slot ? <Portal mount={slot}>{props.children}</Portal> : props.children;
}
