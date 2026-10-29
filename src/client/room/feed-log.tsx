import { For, type JSX, createEffect, on } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import * as styles from "./feed-log.css.ts";

/** Shows the room's chat log, with bot lines in their own color and chat lines as `name: text`. */
export function FeedLog(props: { entries: FeedEntry[] }): JSX.Element {
  let log: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.entries.length,
      () => log?.scrollTo({ top: log.scrollHeight }),
    ),
  );

  return (
    <div
      class={styles.log}
      ref={log}
      role="log"
      aria-label="race chat"
      aria-live="polite"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable log needs keyboard focus
      tabIndex={0}
    >
      <For each={props.entries}>
        {(entry) => (
          <p class={styles.line}>
            <span class={styles.time}>{wallClock(entry.at)}</span>{" "}
            {entry.kind === "chat" && (
              <>
                <bdi class={styles.nick}>{entry.name}</bdi>
                {": "}
              </>
            )}
            <bdi class={entry.kind === "bot" ? styles.bot : undefined}>{entry.text}</bdi>
          </p>
        )}
      </For>
    </div>
  );
}

function wallClock(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
