import { For, type JSX, createEffect, on } from "solid-js";
import type { FeedEntry } from "../../shared/feed-entry.ts";
import * as styles from "./feed-log.css.ts";

/** Represents a line only this browser sees, like a refused command or a lost connection. */
export interface NoticeLine {
  at: number;
  kind: "notice";
  text: string;
}

export type LogLine = FeedEntry | NoticeLine;

/**
 * Shows the room's chat log, with bot lines in their own color, chat lines as `name: text` and
 * notices in red.
 */
export function FeedLog(props: { entries: LogLine[] }): JSX.Element {
  let log: HTMLDivElement | undefined;
  createEffect(
    on(
      () => props.entries.length,
      () => log?.scrollTo({ top: log.scrollHeight }),
    ),
  );
  // Ctrl+A in the focused log selects the log alone, since the whole page is rarely what's wanted.
  const selectAll = (event: KeyboardEvent) => {
    if (event.key === "a" && (event.ctrlKey || event.metaKey) && log) {
      event.preventDefault();
      document.getSelection()?.selectAllChildren(log);
    }
  };

  return (
    <div
      class={styles.log}
      ref={log}
      role="log"
      aria-label="race chat"
      aria-live="polite"
      // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable log needs keyboard focus
      tabIndex={0}
      onKeyDown={selectAll}
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
            <bdi class={lineClass[entry.kind]}>{entry.text}</bdi>
          </p>
        )}
      </For>
    </div>
  );
}

const lineClass: Record<LogLine["kind"], string | undefined> = {
  bot: styles.bot,
  chat: undefined,
  notice: styles.notice,
};

function wallClock(at: number): string {
  return new Date(at).toTimeString().slice(0, 8);
}
