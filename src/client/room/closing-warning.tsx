import { TriangleAlert } from "lucide-solid";
import { type JSX, Show, createSignal, onCleanup } from "solid-js";
import * as styles from "./closing-warning.css.ts";

// Input counts once a minute, which is plenty against a 2-hour limit and keeps messages rare.
const activityEveryMs = 60_000;
const inputEvents = ["pointermove", "pointerdown", "keydown", "touchstart"] as const;

/** Formats the time left as `mm:ss`, never below zero. */
export function timeLeft(closesAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((closesAt - now) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

// Lists what each warning says, and whether input from anyone clears it or a click outside hides it.
const reasons = {
  idle: {
    title: "room closes soon due to inactivity!",
    hint: "move the mouse, tap or type to keep the room open.",
    hidesOnClickOutside: false,
  },
  restart: {
    title: "room closes soon for a server restart!",
    hint: "click anywhere outside this card to hide it.",
    hidesOnClickOutside: true,
  },
} as const;

/**
 * Warns that a room closes soon. An idle warning goes once anyone in the room acts. A restart
 * warning stays until the viewer clicks outside the card.
 */
export function ClosingWarning(props: {
  closesAt: number | null;
  now: number;
  reason?: keyof typeof reasons;
}): JSX.Element {
  const reason = () => reasons[props.reason ?? "idle"];
  const [hidden, setHidden] = createSignal(false);
  let card: HTMLDivElement | undefined;

  const onPointerDown = (event: PointerEvent) => {
    if (reason().hidesOnClickOutside && card && !card.contains(event.target as Node)) {
      setHidden(true);
    }
  };
  document.addEventListener("pointerdown", onPointerDown);
  onCleanup(() => document.removeEventListener("pointerdown", onPointerDown));

  return (
    <Show when={!hidden() && props.closesAt}>
      {(closesAt) => (
        <div class={styles.placement}>
          <div ref={card} class={styles.card} role="alert">
            <h2 class={styles.title}>
              <span class={styles.heading}>
                <TriangleAlert class={styles.icon} aria-hidden="true" /> {reason().title}
              </span>
              {/* Hidden from the alert, or a screen reader would read the card again every second. */}
              <span class={styles.countdown} aria-hidden="true">
                {timeLeft(closesAt(), props.now)}
              </span>
            </h2>
            <p class={styles.text}>{reason().hint}</p>
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
