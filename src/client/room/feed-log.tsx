import { For, type JSX, createEffect, on } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import * as styles from "./feed-log.css.ts";

/** Shows the room's RaceBot lines and chat like an IRC channel. */
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
      aria-label="Race chat"
      aria-live="polite"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable log needs keyboard focus
      tabIndex={0}
    >
      <For each={props.entries}>
        {(entry) => (
          <p class={styles.line}>
            <span class={styles.time}>[{wallClock(entry.at)}]</span>{" "}
            <span class={entry.kind === "bot" ? styles.bot : styles.nick}>
              &lt;<bdi>{entry.kind === "bot" ? "RaceBot" : entry.name}</bdi>&gt;
            </span>{" "}
            <bdi>{entry.text}</bdi>
          </p>
        )}
      </For>
    </div>
  );
}

function wallClock(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
