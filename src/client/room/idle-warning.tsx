import { TriangleAlert } from "lucide-solid";
import { type JSX, Show, onCleanup } from "solid-js";
import * as styles from "./idle-warning.css.ts";

// Input counts once a minute, which is plenty against a 2-hour limit and keeps messages rare.
const activityEveryMs = 60_000;
const inputEvents = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;

/** Formats the time left as `mm:ss`, never below zero. */
export function timeLeft(closesAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((closesAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Warns that an idle room closes soon. Any input from anyone in the room clears it, so the
 * card has no button of its own.
 */
export function IdleWarning(props: { closesAt: number | null; now: number }): JSX.Element {
  return (
    <Show when={props.closesAt}>
      {(closesAt) => (
        <div class={styles.placement}>
          <div class={styles.card} role="alert">
            <h2 class={styles.title}>
              <span class={styles.heading}>
                <TriangleAlert class={styles.icon} aria-hidden="true" /> Room closes soon due to
                inactivity!
              </span>
              <span class={styles.countdown}>{timeLeft(closesAt(), props.now)}</span>
            </h2>
            <p class={styles.text}>Move the mouse, tap or type to keep the room open.</p>
          </div>
        </div>
      )}
    </Show>
  );
}

/** Tells the server someone is still here whenever they use the mouse, touch or keyboard. */
export function useActivityPings(options: {
  send: () => void;
  /** Gives whether the room is warned as idle, when input should count right away. */
  warned: () => boolean;
  clock?: () => number;
}): void {
  const clock = options.clock ?? Date.now;
  let lastSentAt = Number.NEGATIVE_INFINITY;

  const onInput = () => {
    const now = clock();
    if (options.warned() || now - lastSentAt >= activityEveryMs) {
      lastSentAt = now;
      options.send();
    }
  };

  for (const event of inputEvents) {
    window.addEventListener(event, onInput, { passive: true });
  }
  onCleanup(() => {
    for (const event of inputEvents) {
      window.removeEventListener(event, onInput);
    }
  });
}
